// ==========================================
// EXPLAINER PANEL SYSTEM
// Subtle help icons that open a right-edge
// slide panel with structured context.
// ==========================================

(function () {
    'use strict';

    // ---- Create shared DOM elements ----
    const backdrop = document.createElement('div');
    backdrop.className = 'explainer-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.appendChild(backdrop);

    const panel = document.createElement('div');
    panel.className = 'explainer-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Explainer panel');
    panel.innerHTML = `
        <div class="explainer-header">
            <span class="explainer-label">About This Section</span>
            <button class="explainer-close" aria-label="Close explainer">&times;</button>
        </div>
        <div class="explainer-content"></div>
    `;
    document.body.appendChild(panel);

    const panelContent = panel.querySelector('.explainer-content');
    const closeBtn = panel.querySelector('.explainer-close');
    let activeIcon = null;
    let previouslyFocused = null;

    // ---- Open / Close ----

    function openPanel(icon) {
        const data = icon.dataset;
        previouslyFocused = document.activeElement;
        activeIcon = icon;

        // Build content from data attributes
        panelContent.innerHTML = buildContent(data);

        // Update panel aria-label
        panel.setAttribute('aria-label', 'Explainer: ' + (data.explainerTitle || 'Section'));

        // Show
        panel.classList.add('open');
        backdrop.classList.add('visible');
        icon.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';

        // Focus the close button
        requestAnimationFrame(() => {
            closeBtn.focus();
        });
    }

    function closePanel() {
        panel.classList.remove('open');
        backdrop.classList.remove('visible');
        document.body.style.overflow = '';

        if (activeIcon) {
            activeIcon.setAttribute('aria-expanded', 'false');
        }

        // Return focus
        if (previouslyFocused && previouslyFocused.focus) {
            previouslyFocused.focus();
        }

        activeIcon = null;
        previouslyFocused = null;
    }

    // ---- Build panel content from data attributes ----

    function buildContent(data) {
        let html = '';

        // Key Concepts (tech terms explained for laypeople)
        if (data.explainerConcepts) {
            html += conceptsBlock(data.explainerConcepts);
        }

        // My Take (first person, margin-note style)
        if (data.explainerMyTake) {
            html += block('My Take', data.explainerMyTake);
        }

        return html;
    }

    function block(label, text) {
        return `
            <div class="explainer-block">
                <div class="explainer-block-label">${label}</div>
                <p>${text}</p>
            </div>
        `;
    }

    function conceptsBlock(conceptsJSON) {
        try {
            const concepts = JSON.parse(conceptsJSON);
            let html = '<div class="explainer-block"><div class="explainer-block-label">Key Concepts</div>';
            concepts.forEach(function (c) {
                html += '<div style="margin-bottom: 0.6rem;">';
                html += '<span class="explainer-concept">' + c.term + '</span>';
                html += '<div class="explainer-concept-desc">' + c.desc + '</div>';
                html += '</div>';
            });
            html += '</div>';
            return html;
        } catch (e) {
            return '';
        }
    }

    // ---- Event listeners ----

    // Close button
    closeBtn.addEventListener('click', closePanel);

    // Backdrop click
    backdrop.addEventListener('click', closePanel);

    // Escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && panel.classList.contains('open')) {
            closePanel();
        }
    });

    // Focus trap inside panel
    panel.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab') return;

        const focusable = panel.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
            if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    });

    // ---- Delegate clicks on explainer icons ----

    document.addEventListener('click', function (e) {
        var icon = e.target.closest('.explainer-icon');
        if (!icon) return;

        e.preventDefault();
        e.stopPropagation();

        if (panel.classList.contains('open') && activeIcon === icon) {
            closePanel();
        } else {
            if (panel.classList.contains('open')) {
                closePanel();
            }
            openPanel(icon);
        }
    });

    // Also handle Enter/Space on icons
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var icon = e.target.closest('.explainer-icon');
        if (!icon) return;

        e.preventDefault();
        if (panel.classList.contains('open') && activeIcon === icon) {
            closePanel();
        } else {
            if (panel.classList.contains('open')) {
                closePanel();
            }
            openPanel(icon);
        }
    });

})();
