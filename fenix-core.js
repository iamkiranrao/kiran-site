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
  var DEFAULT_AGENT_URL = 'https://api.kiranrao.ai/api/v1/fenix/agent';
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

  // ── Conversation Mode Detection ────────────────────
  // Two modes:
  //   (a) Direct landing — fresh start, zero history, orient to THIS page.
  //   (b) Fenix-guided navigation — ?fenix=continue signals continuation.
  // Without the param, always start a fresh conversation.

  var _urlParams = new URLSearchParams(window.location.search);
  var _isContinuation = _urlParams.get('fenix') === 'continue';
  var _autoOpenPanel = _urlParams.get('fenix-panel') || null;

  // Index in fenixState.messages where THIS page's conversation starts.
  // On continuation, messages before this index are carried context from the
  // previous hop. When navigating again, only snapshot from this index forward
  // so we get true single-hop isolation (A→B carries, but A doesn't leak to C).
  var _hopStartIndex = 0;

  // Clean up Fenix params from URL without reload (keep URL tidy)
  if (_isContinuation || _autoOpenPanel) {
    var cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('fenix');
    cleanUrl.searchParams.delete('fenix-panel');
    window.history.replaceState({}, '', cleanUrl.toString());
  }

  // Restore from sessionStorage (survives page nav, not tab close)
  (function restoreFenixState() {
    if (_isContinuation) {
      // Fenix-guided navigation: restore ONLY the previous hop's context.
      // If you go Homepage → Teardowns → Skills, when you land on Skills
      // you should only have the Teardowns conversation, not the full chain.
      try {
        var saved = sessionStorage.getItem('fenixState');
        if (saved) {
          var parsed = JSON.parse(saved);
          fenixState.sessionId = parsed.sessionId || null;
          // Only carry messages from the last hop (stored at navigation time)
          fenixState.messages = parsed.lastHopMessages || parsed.messages || [];
          fenixState.visitor = parsed.visitor || fenixState.visitor;
          fenixState.explored = parsed.explored || fenixState.explored;
          // Mark where the carried context ends — THIS page's conversation
          // starts after this point. Used for single-hop isolation on next nav.
          _hopStartIndex = fenixState.messages.length;
        }
      } catch (e) { /* ignore */ }
    } else {
      // Direct landing: fresh start — wipe conversation history
      // but preserve explored state for returning visitors
      try {
        var saved = sessionStorage.getItem('fenixState');
        if (saved) {
          var parsed = JSON.parse(saved);
          // Keep explored state (what cards they've seen, etc.)
          fenixState.explored = parsed.explored || fenixState.explored;
          // Preserve visitor identity (connected state)
          fenixState.visitor = parsed.visitor || fenixState.visitor;
        }
      } catch (e) { /* ignore */ }
      // Clear conversation — new page, new context
      fenixState.messages = [];
      // Fresh session ID so backend starts a clean conversation
      fenixState.sessionId = generateSessionId();
      sessionStorage.removeItem('fenixState');
    }
  })();

  // Handle bfcache restoration (back/forward button)
  // When the page is restored from bfcache, JS doesn't re-run,
  // so stale conversation state can persist. Force a reset.
  window.addEventListener('pageshow', function (event) {
    if (event.persisted && !_isContinuation) {
      fenixState.messages = [];
      fenixState.sessionId = generateSessionId();
      sessionStorage.removeItem('fenixState');
    }
  });

  // Restore connected visitor from localStorage (persists across tabs + sessions)
  (function restoreConnectedState() {
    try {
      if (localStorage.getItem('fenix_connected') === 'true') {
        var storedName = localStorage.getItem('fenix_name') || '';
        // Validate: require first + last name (two distinct words)
        // Cleans up stale single-name entries from before validation existed
        var parts = storedName.trim().split(/\s+/);
        if (parts.length < 2 || parts[0].toLowerCase() === (parts[1] || '').toLowerCase()) {
          // Invalid name — wipe connected state entirely
          localStorage.removeItem('fenix_connected');
          localStorage.removeItem('fenix_name');
          localStorage.removeItem('fenix_company');
          localStorage.removeItem('fenix_email');
          return;
        }
        fenixState.visitor.name = storedName;
        fenixState.visitor.company = localStorage.getItem('fenix_company') || null;
        fenixState.visitor.email = localStorage.getItem('fenix_email') || null;
        fenixState.visitor.connected = true;
      }
    } catch (e) { /* ignore */ }
  })();

  function saveFenixState(opts) {
    opts = opts || {};
    try {
      var data = {
        sessionId: fenixState.sessionId,
        messages: fenixState.messages.slice(-40),
        visitor: fenixState.visitor,
        explored: fenixState.explored
      };
      // When navigating, snapshot only THIS page's messages as lastHopMessages.
      // Messages before _hopStartIndex are carried context from the previous hop —
      // exclude them so the destination only gets the current page's conversation.
      if (opts.forNavigation) {
        data.lastHopMessages = fenixState.messages.slice(_hopStartIndex).slice(-20);
      }
      sessionStorage.setItem('fenixState', JSON.stringify(data));
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

  // ── Status Dot — reflects Fenix state (ready/thinking/error) ──
  function setStatusDot(state) {
    var dot = document.querySelector('.ev-status-dot');
    if (!dot) return;
    dot.className = 'ev-status-dot ev-status-dot--' + state;
    dot.setAttribute('title', state.charAt(0).toUpperCase() + state.slice(1));
  }

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

    // [ARRIVAL] is a silent trigger — don't show in chat, don't count as a message
    var isArrival = (userText === '[ARRIVAL]');

    var msgCap = (adapter && adapter.messageCap) || DEFAULT_MSG_CAP;
    if (!isArrival && fenixState.explored.messagesExchanged >= msgCap) {
      addSystemMessage(messageArea, 'We\'ve had a great conversation. Want to continue it in person?');
      if (!fenixState.visitor.connected && adapter && adapter.onMessageCapReached) {
        adapter.onMessageCapReached();
      }
      return;
    }

    if (!isArrival) {
      // Record the visitor message in state (arrivals are invisible)
      fenixState.messages.push({
        role: 'visitor',
        type: 'text',
        content: userText,
        timestamp: Date.now()
      });
      fenixState.explored.messagesExchanged++;
    }

    // Disable input while Fenix is thinking
    fenixState.ui.inputEnabled = false;
    fenixState.ui.fenixTyping = true;
    setInputEnabled(false);
    setStatusDot('thinking');

    // Show typing indicator
    var typingIndicator = el('div', 'ev-msg ev-msg-fenix ev-typing-indicator');
    var typingAvatar = el('img', 'ev-msg-avatar', { src: _logoPath, alt: 'Fenix' });
    var typingDots = el('div', 'ev-typing-dots');
    typingDots.innerHTML = '<span></span><span></span><span></span>';
    typingIndicator.appendChild(typingAvatar);
    typingIndicator.appendChild(typingDots);
    messageArea.appendChild(typingIndicator);
    messageArea.scrollTop = messageArea.scrollHeight;

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

    // Arrival context — include it in the payload and clear the stored value
    if (isArrival && _arrivalContext) {
      payload.arrival_context = _arrivalContext;
      _arrivalContext = null;
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
            // Clean up typing indicator if still present
            var typingOnDone = messageArea.querySelector('.ev-typing-indicator');
            if (typingOnDone) typingOnDone.remove();

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
            setStatusDot('ready');
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
      // Remove typing indicator on error
      var typingOnErr = messageArea.querySelector('.ev-typing-indicator');
      if (typingOnErr) typingOnErr.remove();
      addFenixMessage(messageArea, 'I\'m having a moment — couldn\'t connect to my brain. Try again in a sec.');
      fenixState.ui.inputEnabled = true;
      fenixState.ui.fenixTyping = false;
      setInputEnabled(true);
      setStatusDot('error');
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
          // Remove typing indicator when first response arrives
          var typing = msgArea.querySelector('.ev-typing-indicator');
          if (typing) typing.remove();

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
          // Remove typing indicator on tool use too
          var typingOnTool = msgArea.querySelector('.ev-typing-indicator');
          if (typingOnTool) typingOnTool.remove();

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
          // Then append contextual action pills from adapter (Option C)
          var basePills;
          if (pendingSuggestedPills) {
            basePills = pendingSuggestedPills;
            pendingSuggestedPills = null;
          } else if (adp && adp.getDefaultPills) {
            basePills = adp.getDefaultPills();
          } else {
            basePills = [];
          }
          // Merge contextual pills from adapter (e.g., LinkedIn connect nudge)
          if (adp && adp.getContextualPills) {
            var contextual = adp.getContextualPills();
            if (contextual && contextual.length > 0) {
              basePills = basePills.concat(contextual);
            }
          }
          if (basePills.length > 0) {
            updatePills(basePills.slice(0, 4), adp);
          }
          // Adapter lifecycle hook
          if (adp && adp.onDone) {
            adp.onDone();
          }
          break;
      }
    }
  }


  // ── Connect / Disconnect ──────────────────────────
  // Central connect logic — all adapters use this.
  // Persists to localStorage (survives tab close).
  // Adapter-specific UI updates happen via the onConnect hook.

  function connectVisitor(data) {
    var firstName = (data.first_name || '').trim();
    var lastName = (data.last_name || '').trim();
    // Support legacy single 'name' field — split into first/last
    if (!firstName && data.name) {
      var parts = data.name.trim().split(/\s+/);
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }
    var name = (firstName + (lastName ? ' ' + lastName : '')).trim();
    // Capitalize first letter of each name part (e.g. "kiran rao" → "Kiran Rao")
    name = name.split(' ').map(function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join(' ');
    if (!firstName) return { success: false, reason: 'First name is required' };
    if (!lastName) return { success: false, reason: 'Last name is required' };
    if (firstName.toLowerCase() === lastName.toLowerCase()) return { success: false, reason: 'First and last name cannot be the same' };

    var company = (data.company || '').trim() || null;
    if (!company) return { success: false, reason: 'Company is required' };

    var email = data.email || null;
    var source = data.source || 'chat';

    fenixState.visitor.name = name;
    fenixState.visitor.company = company;
    fenixState.visitor.email = email;
    fenixState.visitor.connected = true;

    try {
      localStorage.setItem('fenix_connected', 'true');
      localStorage.setItem('fenix_name', name);
      if (company) localStorage.setItem('fenix_company', company);
      if (email) localStorage.setItem('fenix_email', email);
    } catch (e) { /* ignore */ }

    saveFenixState();

    // Log to backend guestbook for form + LinkedIn connects.
    // Agent tool connects (source='chat') are already logged server-side.
    if (source !== 'chat') {
      try {
        fetch('https://api.kiranrao.ai/api/v1/fenix/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name,
            company: company,
            email: email,
            page_url: window.location.href,
            conversation_id: fenixState.conversationId || null,
            source: source
          })
        }).catch(function () { /* silent — guestbook logging is best-effort */ });
      } catch (e) { /* ignore */ }
    }

    // Notify the active adapter
    if (_activeAdapter && _activeAdapter.onConnect) {
      _activeAdapter.onConnect({ name: name, company: company, email: email });
    }

    return { success: true, name: name, company: company, email: email };
  }

  function disconnectVisitor() {
    fenixState.visitor.name = null;
    fenixState.visitor.company = null;
    fenixState.visitor.email = null;
    fenixState.visitor.connected = false;

    try {
      localStorage.removeItem('fenix_connected');
      localStorage.removeItem('fenix_name');
      localStorage.removeItem('fenix_company');
      localStorage.removeItem('fenix_email');
    } catch (e) { /* ignore */ }

    saveFenixState();
  }


  // ── Fenix-Guided Navigation ────────────────────────
  // Navigate to a page while preserving conversation continuity.
  // Adds ?fenix=continue so the destination page restores state.
  function navigateWithFenix(url, opts) {
    opts = opts || {};
    // Save with forNavigation flag — snapshots current messages as lastHopMessages
    // so destination only gets THIS page's conversation, not the full chain
    saveFenixState({ forNavigation: true });
    var dest = new URL(url, window.location.origin);
    dest.searchParams.set('fenix', 'continue');
    if (opts.panel) {
      dest.searchParams.set('fenix-panel', opts.panel);
    }
    window.location.href = dest.toString();
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

    // Auto-open panel on Fenix-guided navigation (fix: 13e)
    if (_autoOpenPanel && adapter.showPanel) {
      setTimeout(function () {
        adapter.showPanel(_autoOpenPanel);
      }, 300);
    }

    // Save state after init
    saveFenixState();
  }


  // ── Public API ────────────────────────────────────

  // Arrival context — set by content-adapter on Fenix-guided navigation.
  // Included in the next agent request, then cleared.
  var _arrivalContext = null;

  window.FenixCore = {
    init: initCore,
    fenixState: fenixState,
    isContinuation: _isContinuation,
    autoOpenPanel: _autoOpenPanel,
    setArrivalContext: function (ctx) { _arrivalContext = ctx; },
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
    connectVisitor: connectVisitor,
    disconnectVisitor: disconnectVisitor,
    navigateWithFenix: navigateWithFenix,
    el: el,
    append: append,
    generateSessionId: generateSessionId,
    getAdapter: function () { return _activeAdapter; }
  };

})();
