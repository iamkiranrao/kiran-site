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
    const MAX_MESSAGE_LENGTH = 2000;

    const SUGGESTIONS = [
        "What has Kiran built with AI?",
        "Tell me about Kiran's product teardowns",
        "What's Kiran's approach to product management?",
        "What technologies does Kiran work with?",
    ];

    // ──────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────

    let isOpen = false;
    let isStreaming = false;
    let sessionId = localStorage.getItem(SESSION_KEY) || null;
    let conversationId = null;
    let messages = [];
    let currentAbortController = null;

    // DOM references (set in init)
    let overlay, messagesContainer, inputField, sendBtn, welcomeEl;

    // ──────────────────────────────────────────────
    // Initialization
    // ──────────────────────────────────────────────

    function init() {
        injectHTML();
        cacheDOM();
        bindEvents();
    }

    function injectHTML() {
        const widget = document.createElement('div');
        widget.innerHTML = `
            <div class="fenix-overlay" id="fenix-overlay">
                <div class="fenix-header">
                    <div class="fenix-header-left">
                        <div class="fenix-header-avatar">
                            <img src="images/logo.png" alt="Fenix">
                        </div>
                        <div class="fenix-header-info">
                            <h3>Fenix</h3>
                            <span><span class="fenix-status-dot"></span> Kiran's AI assistant</span>
                        </div>
                    </div>
                    <button class="fenix-close-btn" id="fenix-close" aria-label="Close Fenix">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="fenix-messages" id="fenix-messages">
                    <div class="fenix-welcome" id="fenix-welcome">
                        <h4>Hey! I'm Fenix.</h4>
                        <p>I know everything on Kiran's site. Ask me about his work, teardowns, career, or anything you're curious about.</p>
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
            </div>
        `;
        document.body.appendChild(widget);

        // Create FAB if one doesn't already exist on the page
        if (!document.getElementById('fenix-fab') && !document.querySelector('.fenix-fab')) {
            const fab = document.createElement('button');
            fab.id = 'fenix-fab-auto';
            fab.className = 'fenix-fab-auto';
            fab.setAttribute('aria-label', 'Chat with Fenix');
            fab.title = 'Chat with Fenix';
            fab.innerHTML = '<img src="' + (document.querySelector('link[rel="icon"]')?.href || '/images/logo.png') + '" alt="Fenix" style="width:32px;height:32px;border-radius:50%;">';
            fab.style.cssText = 'position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;z-index:9998;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,0.2);background:var(--bg-secondary, #1a1a1a);transition:transform 0.2s,box-shadow 0.2s;';
            fab.addEventListener('mouseenter', () => { fab.style.transform = 'scale(1.1)'; });
            fab.addEventListener('mouseleave', () => { fab.style.transform = 'scale(1)'; });
            fab.addEventListener('click', () => window.launchFenix());
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

        // Hide tooltip and auto-FAB while widget is open
        const tooltip = document.querySelector('.fenix-tooltip');
        if (tooltip) tooltip.style.opacity = '0';
        const autoFab = document.getElementById('fenix-fab-auto');
        if (autoFab) autoFab.style.display = 'none';
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

        // Restore tooltip and auto-FAB
        const tooltip = document.querySelector('.fenix-tooltip');
        if (tooltip) tooltip.style.opacity = '1';
        const autoFab = document.getElementById('fenix-fab-auto');
        if (autoFab) autoFab.style.display = 'flex';
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
