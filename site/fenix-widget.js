/**
 * Fenix Chat Widget — kirangorapalli.com
 *
 * A floating chat overlay that connects to the Fenix backend via SSE.
 * Lazy-loaded, vanilla JS, no dependencies.
 *
 * Architecture:
 * - IIFE pattern (no global pollution)
 * - EventSource-like SSE via fetch() for POST support
 * - Session persistence via localStorage
 * - Simple markdown rendering (bold, italic, links, lists, code)
 * - Responsive: full-screen on mobile, overlay on desktop
 */
(function () {
    'use strict';

    // ──────────────────────────────────────────────
    // Configuration
    // ──────────────────────────────────────────────

    const API_BASE = 'https://api.kirangorapalli.com';
    const CHAT_ENDPOINT = `${API_BASE}/api/v1/fenix/chat`;
    const SESSION_KEY = 'fenix_session_id';
    const FLAME_ON_KEY = 'fenix_flame_on';
    const FLAME_ON_ONBOARDED_KEY = 'fenix_flame_on_onboarded';
    const MAX_MESSAGE_LENGTH = 2000;

    const SUGGESTION_POOL = [
        "What's something most visitors miss?",
        "What's Kiran's boldest product bet?",
        "How did Kiran build this AI assistant?",
        "What's Kiran like to work with?",
        "What would Kiran change about insurance tech?",
        "Show me the wildest prototype",
        "What has Kiran shipped recently?",
        "What's Kiran's hot take on AI in product?",
    ];
    // Show 4 random picks on each load
    const SUGGESTIONS = SUGGESTION_POOL.sort(() => 0.5 - Math.random()).slice(0, 4);

    // Universal tooltip text — shown on every page
    const TOOLTIP_TEXT = "Start here — I'll tailor this to what you care about";
    const TOOLTIP_DELAY_MS = 1500;   // Show after page settles
    const TOOLTIP_DURATION_MS = 5000; // Visible for 5s
    const TOOLTIP_SEEN_KEY = 'fenix_tooltip_seen';

    // ──────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────

    let isOpen = false;
    let isStreaming = false;
    let sessionId = localStorage.getItem(SESSION_KEY) || null;
    let conversationId = null;
    let messages = [];
    let currentAbortController = null;
    let flameOn = localStorage.getItem(FLAME_ON_KEY) === 'true';
    let flameOnOnboarded = localStorage.getItem(FLAME_ON_ONBOARDED_KEY) === 'true';

    // DOM references (set in init)
    let overlay, messagesContainer, inputField, sendBtn, welcomeEl;

    // ──────────────────────────────────────────────
    // Initialization
    // ──────────────────────────────────────────────

    function init() {
        injectHTML();
        cacheDOM();
        bindEvents();
        scheduleTooltip();
    }

    function injectHTML() {
        const widget = document.createElement('div');
        widget.innerHTML = `
            <div class="fenix-overlay" id="fenix-overlay">
                <div class="fenix-header">
                    <div class="fenix-header-left">
                        <div class="fenix-header-avatar">
                            <img src="/images/logo.png" alt="Fenix">
                        </div>
                        <div class="fenix-header-info">
                            <h3>Fenix</h3>
                            <span><span class="fenix-status-dot"></span> Kiran's AI assistant</span>
                        </div>
                    </div>
                    <div class="fenix-header-actions">
                        <label class="fenix-flame-toggle" id="fenix-flame-toggle" title="Flame On: Talk directly to Fenix about Kiran's working process">
                            <input type="checkbox" id="fenix-flame-checkbox" ${flameOn ? 'checked' : ''}>
                            <span class="fenix-flame-slider">
                                <svg class="fenix-flame-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 23c-3.866 0-7-3.134-7-7 0-3.866 4-9 7-13 3 4 7 9.134 7 13 0 3.866-3.134 7-7 7zm0-4c1.657 0 3-1.343 3-3 0-1.657-2-5-3-7-1 2-3 5.343-3 7 0 1.657 1.343 3 3 3z"/>
                                </svg>
                            </span>
                        </label>
                        <button class="fenix-close-btn" id="fenix-close" aria-label="Close Fenix">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="fenix-messages" id="fenix-messages">
                    <div class="fenix-welcome" id="fenix-welcome">
                        <h4>Hey! I'm Fenix.</h4>
                        <p>I'm Kiran's AI assistant, here to help you navigate this site and experience it in a way that's right for you.</p>
                        <div class="fenix-suggestions" id="fenix-suggestions"></div>
                    </div>
                </div>
                <div class="fenix-input-area">
                    <textarea class="fenix-input" id="fenix-input" placeholder="Ask Fenix anything..." rows="1" maxlength="${MAX_MESSAGE_LENGTH}"></textarea>
                    <button class="fenix-send-btn" id="fenix-send" aria-label="Send message">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                    </button>
                </div>
                <div class="fenix-disclaimer">
                    Fenix is AI and can make mistakes. <a href="mailto:kiranrao@gmail.com" class="fenix-disclaimer-link">Reach out to Kiran</a> · <button type="button" class="fenix-feedback-btn" id="fenix-feedback-trigger">Give feedback</button>
                </div>
            </div>
        `;
        document.body.appendChild(widget);

        // Create FAB if one doesn't already exist on the page
        // Check for all known FAB selectors: #fenix-fab, .fenix-fab, .ai-assistant (hardcoded on some pages)
        const existingFab = document.getElementById('fenix-fab') || document.querySelector('.fenix-fab') || document.querySelector('.ai-assistant');
        if (!existingFab) {
            const fab = document.createElement('div');
            fab.id = 'fenix-fab-auto';
            fab.className = 'ai-assistant-wrapper';
            fab.setAttribute('aria-label', 'Chat with Fenix');
            fab.innerHTML = '<div class="ai-assistant"><img src="/images/logo.png" alt="Fenix AI" class="fenix-fab-logo"></div>';
            fab.querySelector('.ai-assistant').addEventListener('click', () => window.launchFenix());
            document.body.appendChild(fab);
        }

        // Populate suggestions
        const suggestionsEl = document.getElementById('fenix-suggestions');
        SUGGESTIONS.forEach(text => {
            const btn = document.createElement('button');
            btn.className = 'fenix-suggestion';
            btn.textContent = text;
            btn.addEventListener('click', () => sendMessage(text));
            suggestionsEl.appendChild(btn);
        });
    }

    function cacheDOM() {
        overlay = document.getElementById('fenix-overlay');
        messagesContainer = document.getElementById('fenix-messages');
        inputField = document.getElementById('fenix-input');
        sendBtn = document.getElementById('fenix-send');
        welcomeEl = document.getElementById('fenix-welcome');
    }

    function bindEvents() {
        // Close button
        document.getElementById('fenix-close').addEventListener('click', closeWidget);

        // Flame On toggle
        document.getElementById('fenix-flame-checkbox').addEventListener('change', handleFlameToggle);

        // Send button
        sendBtn.addEventListener('click', handleSend);

        // Enter to send (Shift+Enter for newline)
        inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        });

        // Auto-resize textarea
        inputField.addEventListener('input', () => {
            inputField.style.height = 'auto';
            inputField.style.height = Math.min(inputField.scrollHeight, 100) + 'px';
        });

        // Escape to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isOpen) closeWidget();
        });

        // Feedback trigger — scroll to site feedback form or show inline
        document.getElementById('fenix-feedback-trigger').addEventListener('click', handleFeedbackClick);

        // Override the existing launchFenix function
        window.launchFenix = openWidget;

        // Also handle explore pills with pre-filled messages
        window.launchFenixWithMessage = function (msg) {
            openWidget();
            if (msg) {
                setTimeout(() => sendMessage(msg), 300);
            }
        };
    }

    // ──────────────────────────────────────────────
    // Open / Close
    // ──────────────────────────────────────────────

    function openWidget() {
        if (isOpen) return;
        isOpen = true;
        overlay.style.display = 'flex';
        // Trigger reflow for animation
        overlay.offsetHeight;
        overlay.classList.add('active');
        overlay.classList.remove('closing');
        inputField.focus();

        // Sync Flame On visual state
        if (flameOn) {
            const toggle = document.getElementById('fenix-flame-toggle');
            if (toggle) toggle.classList.add('active');
            overlay.classList.add('flame-on-mode');
        }

        // Hide tooltip and FAB while widget is open
        const tooltip = document.querySelector('.fenix-tooltip');
        if (tooltip) tooltip.remove();
        const fabWrapper = document.querySelector('.ai-assistant-wrapper');
        if (fabWrapper) fabWrapper.style.display = 'none';
    }

    function closeWidget() {
        if (!isOpen) return;
        isOpen = false;
        overlay.classList.add('closing');
        overlay.classList.remove('active');

        // Abort any active stream
        if (currentAbortController) {
            currentAbortController.abort();
            currentAbortController = null;
            isStreaming = false;
        }

        setTimeout(() => {
            overlay.style.display = 'none';
            overlay.classList.remove('closing');
        }, 300);

        // Restore FAB (tooltip is one-shot, doesn't come back)
        const fabWrapper = document.querySelector('.ai-assistant-wrapper');
        if (fabWrapper) fabWrapper.style.display = 'flex';
    }

    // ──────────────────────────────────────────────
    // Feedback Handler
    // ──────────────────────────────────────────────

    function handleFeedbackClick() {
        // Check if the site feedback form exists on this page (index.html)
        const siteFeedbackForm = document.getElementById('feedbackForm');
        if (siteFeedbackForm) {
            // Close the widget and scroll to the existing feedback form
            closeWidget();
            setTimeout(() => {
                siteFeedbackForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Briefly highlight it
                siteFeedbackForm.style.transition = 'box-shadow 0.3s';
                siteFeedbackForm.style.boxShadow = '0 0 0 2px rgba(124,181,212,0.6), 0 0 20px rgba(124,181,212,0.15)';
                siteFeedbackForm.style.borderRadius = '12px';
                setTimeout(() => { siteFeedbackForm.style.boxShadow = 'none'; }, 2500);
            }, 350);
        } else {
            // On other pages: show inline feedback inside the widget
            showInlineFeedback();
        }
    }

    function showInlineFeedback() {
        const messagesEl = document.getElementById('fenix-messages');
        // Remove any existing feedback form
        const existing = messagesEl.querySelector('.fenix-feedback-inline');
        if (existing) { existing.remove(); return; }

        const feedbackEl = document.createElement('div');
        feedbackEl.className = 'fenix-feedback-inline';
        feedbackEl.innerHTML = `
            <p class="fenix-feedback-title">How's your experience with Fenix?</p>
            <div class="fenix-feedback-faces">
                <button type="button" data-rating="love" title="Love it" class="fenix-fb-face">&#x1F60D;</button>
                <button type="button" data-rating="like" title="Like it" class="fenix-fb-face">&#x1F60A;</button>
                <button type="button" data-rating="neutral" title="It's okay" class="fenix-fb-face">&#x1F610;</button>
                <button type="button" data-rating="dislike" title="Not great" class="fenix-fb-face">&#x1F61E;</button>
            </div>
            <textarea class="fenix-fb-comment" placeholder="Optional: tell Kiran what could be better..." rows="2"></textarea>
            <div class="fenix-fb-actions">
                <button type="button" class="fenix-fb-send">Send Feedback</button>
                <button type="button" class="fenix-fb-cancel">Cancel</button>
            </div>
            <p class="fenix-fb-thanks" style="display:none;">Thanks for your feedback!</p>
        `;

        messagesEl.appendChild(feedbackEl);
        messagesEl.scrollTop = messagesEl.scrollHeight;

        let selectedRating = '';

        // Face selection
        feedbackEl.querySelectorAll('.fenix-fb-face').forEach(btn => {
            btn.addEventListener('click', () => {
                feedbackEl.querySelectorAll('.fenix-fb-face').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                selectedRating = btn.dataset.rating;
            });
        });

        // Cancel
        feedbackEl.querySelector('.fenix-fb-cancel').addEventListener('click', () => {
            feedbackEl.remove();
        });

        // Send — posts to Netlify form endpoint (same as site feedback)
        feedbackEl.querySelector('.fenix-fb-send').addEventListener('click', async () => {
            if (!selectedRating) { return; }
            const comment = feedbackEl.querySelector('.fenix-fb-comment').value || '';
            try {
                const body = new URLSearchParams({
                    'form-name': 'site-feedback',
                    'rating': selectedRating,
                    'comment': `[Fenix Widget] ${comment}`,
                });
                await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
            } catch (e) { /* silently fail */ }
            feedbackEl.querySelector('.fenix-fb-actions').style.display = 'none';
            feedbackEl.querySelector('.fenix-fb-comment').style.display = 'none';
            feedbackEl.querySelector('.fenix-feedback-faces').style.display = 'none';
            feedbackEl.querySelector('.fenix-feedback-title').style.display = 'none';
            feedbackEl.querySelector('.fenix-fb-thanks').style.display = 'block';
            setTimeout(() => feedbackEl.remove(), 2000);
        });
    }

    // ──────────────────────────────────────────────
    // Flame On Toggle
    // ──────────────────────────────────────────────

    function handleFlameToggle(e) {
        flameOn = e.target.checked;
        localStorage.setItem(FLAME_ON_KEY, flameOn);

        // Update header visual
        const toggle = document.getElementById('fenix-flame-toggle');
        if (flameOn) {
            toggle.classList.add('active');
            overlay.classList.add('flame-on-mode');
        } else {
            toggle.classList.remove('active');
            overlay.classList.remove('flame-on-mode');
        }

        // Show onboarding on first activation
        if (flameOn && !flameOnOnboarded) {
            showFlameOnOnboarding();
            flameOnOnboarded = true;
            localStorage.setItem(FLAME_ON_ONBOARDED_KEY, 'true');
        } else if (flameOn) {
            // Brief mode-switch confirmation
            appendSystemMessage('Flame On activated. I\'ll answer from Kiran\'s working process — journal entries, session transcripts, and build notes.');
        } else {
            appendSystemMessage('Flame On deactivated. Back to answering from Kiran\'s published portfolio content.');
        }
    }

    function showFlameOnOnboarding() {
        const onboardingHtml = `
            <div class="fenix-onboarding">
                <div class="fenix-onboarding-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#f97316">
                        <path d="M12 23c-3.866 0-7-3.134-7-7 0-3.866 4-9 7-13 3 4 7 9.134 7 13 0 3.866-3.134 7-7 7zm0-4c1.657 0 3-1.343 3-3 0-1.657-2-5-3-7-1 2-3 5.343-3 7 0 1.657 1.343 3 3 3z"/>
                    </svg>
                </div>
                <h4>Flame On Mode</h4>
                <p>You've unlocked a different side of Fenix. In this mode, I answer from Kiran's <strong>working process</strong> — the real sessions, journal entries, and build notes behind the polished portfolio.</p>
                <div class="fenix-onboarding-details">
                    <p><strong>What changes:</strong></p>
                    <p>• I draw from daily journal entries, session transcripts, and product guides instead of published site content</p>
                    <p>• You'll hear about how decisions were actually made, what failed, and what Kiran learned</p>
                    <p>• I'm constantly learning — if I don't have an answer, I'll tell you honestly</p>
                    <p><strong>What stays the same:</strong></p>
                    <p>• I'm still Fenix, Kiran's AI assistant</p>
                    <p>• Everything I say is grounded in real evidence, never fabricated</p>
                </div>
                <p class="fenix-onboarding-hint">Toggle the flame icon anytime to switch back to the published portfolio view.</p>
            </div>
        `;

        const msgEl = document.createElement('div');
        msgEl.className = 'fenix-message fenix-message-assistant fenix-onboarding-msg';
        msgEl.innerHTML = onboardingHtml;
        messagesContainer.appendChild(msgEl);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function appendSystemMessage(text) {
        const msgEl = document.createElement('div');
        msgEl.className = 'fenix-message fenix-system-message';
        msgEl.innerHTML = `<div class="fenix-system-text">${text}</div>`;
        messagesContainer.appendChild(msgEl);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // ──────────────────────────────────────────────
    // Contextual Tooltip
    // ──────────────────────────────────────────────

    function scheduleTooltip() {
        // Don't show if widget is already open or if already seen this session for this path
        const path = window.location.pathname;
        const seenPaths = JSON.parse(sessionStorage.getItem(TOOLTIP_SEEN_KEY) || '[]');
        if (seenPaths.includes(path)) return;

        setTimeout(() => {
            if (isOpen) return; // Widget opened before tooltip fired

            // Mark as seen for this session
            seenPaths.push(path);
            sessionStorage.setItem(TOOLTIP_SEEN_KEY, JSON.stringify(seenPaths));

            // Create tooltip element
            const tip = document.createElement('div');
            tip.className = 'fenix-tooltip';
            tip.textContent = TOOLTIP_TEXT;
            tip.addEventListener('click', () => {
                tip.remove();
                window.launchFenix();
            });
            document.body.appendChild(tip);

            // Fade in
            requestAnimationFrame(() => {
                tip.classList.add('fenix-tooltip-visible');
            });

            // Auto-dismiss after duration
            setTimeout(() => {
                tip.classList.remove('fenix-tooltip-visible');
                tip.classList.add('fenix-tooltip-hiding');
                setTimeout(() => tip.remove(), 400);
            }, TOOLTIP_DURATION_MS);
        }, TOOLTIP_DELAY_MS);
    }

    // ──────────────────────────────────────────────
    // Message Handling
    // ──────────────────────────────────────────────

    function handleSend() {
        const text = inputField.value.trim();
        if (!text || isStreaming) return;
        sendMessage(text);
    }

    async function sendMessage(text) {
        if (isStreaming) return;

        // Hide welcome state
        if (welcomeEl) {
            welcomeEl.style.display = 'none';
        }

        // Add user message
        appendMessage('user', text);
        inputField.value = '';
        inputField.style.height = 'auto';

        // Show typing indicator
        const typingEl = showTyping();
        isStreaming = true;
        sendBtn.disabled = true;

        // Get page context
        const pageContext = window.location.pathname;

        try {
            await streamChat(text, pageContext, typingEl);
        } catch (err) {
            removeTyping(typingEl);
            if (err.name !== 'AbortError') {
                appendError("Something went wrong. Please try again.");
            }
        } finally {
            isStreaming = false;
            sendBtn.disabled = false;
            inputField.focus();
        }
    }

    // ──────────────────────────────────────────────
    // SSE Streaming (via fetch, since we need POST)
    // ──────────────────────────────────────────────

    async function streamChat(message, pageContext, typingEl) {
        currentAbortController = new AbortController();

        const response = await fetch(CHAT_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message,
                session_id: sessionId,
                page_context: pageContext,
                flame_on: flameOn,
            }),
            signal: currentAbortController.signal,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let assistantText = '';
        let assistantEl = null;
        let citations = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Parse SSE events from the buffer
            const events = parseSSEBuffer(buffer);
            buffer = events.remaining;

            for (const event of events.parsed) {
                switch (event.event) {
                    case 'session':
                        sessionId = event.data.session_id;
                        conversationId = event.data.conversation_id;
                        localStorage.setItem(SESSION_KEY, sessionId);
                        break;

                    case 'persona':
                        // Could show persona badge — for now just log
                        break;

                    case 'chunk':
                        // Remove typing indicator on first chunk
                        if (!assistantEl) {
                            removeTyping(typingEl);
                            assistantEl = appendMessage('assistant', '');
                        }
                        assistantText += event.data.text;
                        updateMessageContent(assistantEl, assistantText);
                        scrollToBottom();
                        break;

                    case 'citations':
                        citations = event.data.citations || [];
                        if (assistantEl && citations.length > 0) {
                            appendCitations(assistantEl, citations);
                        }
                        break;

                    case 'nudge':
                        // Nudge is embedded in the response text via system prompt
                        break;

                    case 'done':
                        break;

                    case 'error':
                        removeTyping(typingEl);
                        appendError(event.data.message || "Something went wrong.");
                        break;
                }
            }
        }

        // If no chunks were received, remove typing
        if (!assistantEl) {
            removeTyping(typingEl);
            appendError("No response received. Please try again.");
        }

        currentAbortController = null;
    }

    function parseSSEBuffer(buffer) {
        const parsed = [];
        const lines = buffer.split('\n');
        let remaining = '';
        let currentEvent = null;
        let currentData = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // If this is the last line and doesn't end with a newline,
            // it might be incomplete
            if (i === lines.length - 1 && line !== '') {
                remaining = line;
                continue;
            }

            if (line.startsWith('event: ')) {
                currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
                currentData.push(line.slice(6));
            } else if (line.startsWith(':')) {
                // Comment (heartbeat) — ignore
            } else if (line === '') {
                // Empty line = end of event
                if (currentData.length > 0) {
                    const dataStr = currentData.join('\n');
                    try {
                        const data = JSON.parse(dataStr);
                        parsed.push({
                            event: currentEvent || 'message',
                            data: data,
                        });
                    } catch (e) {
                        // Non-JSON data
                        parsed.push({
                            event: currentEvent || 'message',
                            data: { text: dataStr },
                        });
                    }
                }
                currentEvent = null;
                currentData = [];
            }
        }

        // If there's leftover data that wasn't terminated
        if (currentData.length > 0 || currentEvent) {
            const leftover = [];
            if (currentEvent) leftover.push(`event: ${currentEvent}`);
            currentData.forEach(d => leftover.push(`data: ${d}`));
            remaining = leftover.join('\n') + (remaining ? '\n' + remaining : '');
        }

        return { parsed, remaining };
    }

    // ──────────────────────────────────────────────
    // DOM Helpers
    // ──────────────────────────────────────────────

    function appendMessage(role, content) {
        const el = document.createElement('div');
        el.className = `fenix-msg ${role}`;
        if (role === 'assistant') {
            el.innerHTML = renderMarkdown(content);
        } else {
            el.textContent = content;
        }
        messagesContainer.appendChild(el);
        messages.push({ role, content });
        scrollToBottom();
        return el;
    }

    function updateMessageContent(el, text) {
        el.innerHTML = renderMarkdown(text);
    }

    function appendCitations(msgEl, citations) {
        const container = document.createElement('div');
        container.className = 'fenix-citations';
        citations.forEach(c => {
            if (!c.url) return;
            const chip = document.createElement('a');
            chip.className = 'fenix-citation-chip';
            chip.href = c.url;
            chip.target = '_blank';
            chip.rel = 'noopener';
            chip.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg> ${escapeHtml(c.title || c.content_type)}`;
            container.appendChild(chip);
        });
        msgEl.appendChild(container);
    }

    function appendError(text) {
        const el = document.createElement('div');
        el.className = 'fenix-error';
        el.textContent = text;
        messagesContainer.appendChild(el);
        scrollToBottom();
    }

    function showTyping() {
        const el = document.createElement('div');
        el.className = 'fenix-typing';
        el.innerHTML = `
            <div class="fenix-typing-dots">
                <span></span><span></span><span></span>
            </div>
            <span>Fenix is thinking...</span>
        `;
        messagesContainer.appendChild(el);
        scrollToBottom();
        return el;
    }

    function removeTyping(el) {
        if (el && el.parentNode) {
            el.parentNode.removeChild(el);
        }
    }

    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // ──────────────────────────────────────────────
    // Simple Markdown Renderer
    // ──────────────────────────────────────────────

    function renderMarkdown(text) {
        if (!text) return '';

        let html = escapeHtml(text);

        // Code blocks (```...```)
        html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

        // Inline code (`...`)
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Bold (**...**)
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // Italic (*...*)
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

        // Links [text](url)
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

        // Unordered lists (- item)
        html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

        // Paragraphs (double newline)
        html = html.replace(/\n\n/g, '</p><p>');
        html = '<p>' + html + '</p>';

        // Single newlines within paragraphs
        html = html.replace(/\n/g, '<br>');

        // Clean up empty paragraphs
        html = html.replace(/<p><\/p>/g, '');
        html = html.replace(/<p><br><\/p>/g, '');

        return html;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ──────────────────────────────────────────────
    // Bootstrap
    // ──────────────────────────────────────────────

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
