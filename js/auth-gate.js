/**
 * auth-gate.js — Client-side auth gate using Supabase Auth
 *
 * Replaces the old Netlify-function access code system with Supabase
 * magic link authentication. Works with the existing CSS class structure:
 *   .gated-content.locked   → blurred, height-constrained
 *   .gated-content.unlocked → fully visible
 *   .gate-prompt             → visible when locked, hidden when unlocked
 *
 * Usage: Include Supabase JS SDK + this script on any gated page:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
 *   <script src="js/auth-gate.js"></script>
 *
 * The script auto-initializes on DOMContentLoaded. It:
 *   1. Fetches Supabase config from the backend API
 *   2. Checks for an existing session (or magic link callback)
 *   3. Unlocks gated content if authenticated
 *   4. Shows a magic link login prompt if not
 *
 * Architecture Rule #5: Core content is readable without JS (progressive
 * enhancement). The gate is additive — the page shell always loads.
 */

(function () {
    'use strict';

    // ── Config ──────────────────────────────────────────────────
    const API_BASE = 'https://api.kiranrao.ai';
    const CONFIG_ENDPOINT = `${API_BASE}/api/v1/auth/config`;
    const SITE_URL = 'https://kiranrao.ai';

    // Allow localhost for development
    const isLocal = window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1';

    // ── DOM references ──────────────────────────────────────────
    let gatedContent, gatePrompt, gateInput, gateSubmit, gateError;
    let supabase = null;

    // ── Initialize ──────────────────────────────────────────────
    async function init() {
        gatedContent = document.getElementById('gatedContent');
        gatePrompt = document.getElementById('gatePrompt');
        gateInput = document.getElementById('gateInput');
        gateSubmit = document.getElementById('gateSubmit');
        gateError = document.getElementById('gateError');

        if (!gatedContent) {
            console.warn('[auth-gate] No #gatedContent found — skipping auth gate.');
            return;
        }

        // 1. Check for legacy access code session (migration bridge)
        if (checkLegacyAccess()) {
            unlockContent();
            return;
        }

        // 2. Fetch Supabase config and initialize client
        try {
            const config = await fetchConfig();
            supabase = window.supabase.createClient(config.supabase_url, config.supabase_anon_key);
        } catch (err) {
            console.error('[auth-gate] Failed to initialize Supabase:', err);
            // Fall back — show error in gate prompt
            showGateError('Unable to connect to auth service. Please try again later.');
            return;
        }

        // 3. Check for magic link callback (hash fragment with access_token)
        if (window.location.hash && window.location.hash.includes('access_token')) {
            await handleMagicLinkCallback();
            return;
        }

        // 4. Check for existing Supabase session
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            unlockContent();
            updatePromptForLoggedIn(session.user);
            return;
        }

        // 5. No session — set up login prompt
        setupLoginPrompt();

        // 6. Listen for auth state changes (e.g., tab comes back into focus after login)
        supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                unlockContent();
                updatePromptForLoggedIn(session.user);
                showToast('Access granted. Welcome.');
            } else if (event === 'SIGNED_OUT') {
                lockContent();
            }
        });
    }

    // ── Fetch config from API ───────────────────────────────────
    async function fetchConfig() {
        const resp = await fetch(CONFIG_ENDPOINT);
        if (!resp.ok) throw new Error(`Config fetch failed: ${resp.status}`);
        return resp.json();
    }

    // ── Legacy access code bridge ───────────────────────────────
    // Users who unlocked via the old access code system keep access
    // until their session expires. This eases the migration.
    function checkLegacyAccess() {
        try {
            const stored = localStorage.getItem('career_access');
            if (!stored) return false;
            const { token, expires } = JSON.parse(stored);
            if (!token || !expires) return false;
            if (new Date(expires) < new Date()) {
                localStorage.removeItem('career_access');
                return false;
            }
            return true;
        } catch (e) {
            localStorage.removeItem('career_access');
            return false;
        }
    }

    // ── Magic link callback ─────────────────────────────────────
    async function handleMagicLinkCallback() {
        try {
            // Supabase JS SDK auto-detects the hash and exchanges the token
            const { data: { session }, error } = await supabase.auth.getSession();

            if (error) throw error;

            if (session) {
                unlockContent();
                updatePromptForLoggedIn(session.user);
                showToast('Access granted. Welcome.');
                // Clean up URL hash
                window.history.replaceState({}, '', window.location.pathname + window.location.search);
            } else {
                setupLoginPrompt();
                showGateError('Login link expired. Please request a new one.');
            }
        } catch (err) {
            console.error('[auth-gate] Magic link callback error:', err);
            setupLoginPrompt();
            showGateError('Something went wrong. Please try again.');
        }
    }

    // ── Unlock / Lock content ───────────────────────────────────
    function unlockContent() {
        if (!gatedContent) return;
        gatedContent.classList.remove('locked');
        gatedContent.classList.add('unlocked');
        gatedContent.style.maxHeight = 'none';
        gatedContent.style.overflow = 'visible';
    }

    function lockContent() {
        if (!gatedContent) return;
        gatedContent.classList.remove('unlocked');
        gatedContent.classList.add('locked');
        gatedContent.style.maxHeight = '';
        gatedContent.style.overflow = '';
    }

    // ── Login prompt setup ──────────────────────────────────────
    function setupLoginPrompt() {
        if (!gateInput || !gateSubmit) return;

        // Update placeholder and button text for email login
        gateInput.type = 'email';
        gateInput.placeholder = 'Enter your email';
        gateInput.autocomplete = 'email';
        gateSubmit.textContent = 'Send Login Link';

        // Update prompt text
        const promptTitle = gatePrompt?.querySelector('h3');
        const promptDesc = gatePrompt?.querySelector('p');
        if (promptTitle) promptTitle.textContent = 'Sign in to view this content';
        if (promptDesc) promptDesc.textContent = 'Enter your email and we\'ll send you a magic login link. No password needed.';

        // Remove old event listeners by cloning
        const newSubmit = gateSubmit.cloneNode(true);
        gateSubmit.parentNode.replaceChild(newSubmit, gateSubmit);
        gateSubmit = newSubmit;

        const newInput = gateInput.cloneNode(true);
        gateInput.parentNode.replaceChild(newInput, gateInput);
        gateInput = newInput;

        // Attach new listeners
        gateSubmit.addEventListener('click', handleLogin);
        gateInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
        gateInput.addEventListener('input', () => {
            if (gateError) gateError.textContent = '';
            gateInput.classList.remove('error');
        });
    }

    // ── Handle login submission ─────────────────────────────────
    async function handleLogin() {
        const email = gateInput.value.trim();
        if (!email) {
            gateInput.classList.add('error');
            setTimeout(() => gateInput.classList.remove('error'), 600);
            return;
        }

        // Basic email validation
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showGateError('Please enter a valid email address.');
            return;
        }

        gateSubmit.disabled = true;
        gateSubmit.textContent = 'Sending...';
        if (gateError) gateError.textContent = '';

        try {
            // Determine redirect URL (back to current page)
            const redirectTo = isLocal
                ? window.location.href.split('#')[0]
                : `${SITE_URL}${window.location.pathname}`;

            const { error } = await supabase.auth.signInWithOtp({
                email: email,
                options: {
                    emailRedirectTo: redirectTo,
                },
            });

            if (error) throw error;

            // Show success state
            showGateSuccess(email);
        } catch (err) {
            console.error('[auth-gate] Login error:', err);
            showGateError('Could not send login link. Please try again.');
        } finally {
            gateSubmit.disabled = false;
            gateSubmit.textContent = 'Send Login Link';
        }
    }

    // ── UI updates ──────────────────────────────────────────────
    function showGateError(msg) {
        if (gateError) {
            gateError.textContent = msg;
            gateError.style.color = '#e74c3c';
        }
    }

    function showGateSuccess(email) {
        if (!gatePrompt) return;
        const inner = gatePrompt.querySelector('.gate-prompt-inner');
        if (!inner) return;

        // Replace prompt content with success message
        const inputRow = inner.querySelector('.gate-input-row');
        const errorMsg = inner.querySelector('.gate-error-msg');
        const contactLinks = inner.querySelector('.gate-contact-links');

        if (contactLinks) contactLinks.style.display = 'none';
        if (errorMsg) errorMsg.textContent = '';

        if (inputRow) {
            inputRow.innerHTML = `
                <div style="text-align:center; padding: 1rem 0;">
                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">✉️</div>
                    <p style="color: var(--text-primary); font-weight: 500; margin: 0 0 0.5rem;">
                        Check your email
                    </p>
                    <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0 0 1rem;">
                        We sent a login link to <strong>${escapeHtml(email)}</strong>.
                        Click the link to access this content.
                    </p>
                    <button class="gate-submit" id="gateResend" style="font-size: 0.85rem; opacity: 0.7;">
                        Didn't get it? Resend
                    </button>
                </div>
            `;
            // Resend handler
            const resend = document.getElementById('gateResend');
            if (resend) {
                resend.addEventListener('click', async () => {
                    resend.disabled = true;
                    resend.textContent = 'Sending...';
                    try {
                        const redirectTo = isLocal
                            ? window.location.href.split('#')[0]
                            : `${SITE_URL}${window.location.pathname}`;
                        await supabase.auth.signInWithOtp({
                            email: email,
                            options: { emailRedirectTo: redirectTo },
                        });
                        resend.textContent = 'Sent! Check your email.';
                    } catch (e) {
                        resend.textContent = 'Could not resend. Try again.';
                    }
                    setTimeout(() => {
                        resend.disabled = false;
                        resend.textContent = 'Didn\'t get it? Resend';
                    }, 10000);
                });
            }
        }

        const title = inner.querySelector('h3');
        const desc = inner.querySelector('p');
        if (title) title.textContent = 'Magic link sent';
        if (desc) desc.textContent = '';
    }

    function updatePromptForLoggedIn(user) {
        // When logged in, the gate-prompt is hidden by CSS (.unlocked ~ .gate-prompt { display: none })
        // But update it in case it becomes visible (e.g., via JS toggle)
        if (!gatePrompt) return;
        const inner = gatePrompt.querySelector('.gate-prompt-inner');
        if (!inner) return;
        const title = inner.querySelector('h3');
        if (title) {
            const name = user?.user_metadata?.display_name || user?.email || 'there';
            title.textContent = `Welcome, ${name}`;
        }
    }

    // ── Utilities ───────────────────────────────────────────────
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function showToast(message) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add('visible');
        setTimeout(() => toast.classList.remove('visible'), 3000);
    }

    // ── Boot ────────────────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
