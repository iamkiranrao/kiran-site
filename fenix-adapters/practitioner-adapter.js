/**
 * ============================================
 * PRACTITIONER ADAPTER
 * Fenix page adapter for the Practitioner persona (product / design / data folks).
 * v1: single card — Stuck Diagnostic tool.
 *
 * Requires: fenix-core.js loaded first.
 * Hook: persona-system.js calls PractitionerExperience.init('practitioner')
 * ============================================
 */

(function () {
  'use strict';

  var FC = window.FenixCore;
  if (!FC) {
    console.error('PractitionerExperience requires FenixCore');
    return;
  }
  var el = FC.el;
  var append = FC.append;
  var fenixState = FC.fenixState;

  // ── Configuration ─────────────────────────────────
  var CC_API_BASE = 'https://cc.kiranrao.ai';
  var CC_API_KEY = 'H3Ycu0N5kfv5MERh_5mYwYcMbGu6pYUv2y1KSgsMBLk';

  // ── Practitioner-Specific Content ─────────────────

  var FENIX_OPENING = "Quick context. Kiran built this site as a workshop, not a portfolio. The card on the left is a real tool. Tell it where you're stuck and it diagnoses the kind of stuckness, then prescribes the next move. Most stuck moments aren't what they look like from the inside.";

  var STUCK_LEAD_IN = "Most stuck moments look the same from the inside, but they're not. Problem-stuck and solution-stuck need completely different moves. Tell me where you are. I'll show you what kind.";

  var STUCK_STARTERS = [
    "We built a tool nobody's adopting. We've tried positioning, integrations, even gave it away free. Engagement is flat.",
    "My roadmap keeps getting reshuffled. Every quarter we relitigate the same debates and end up where we started.",
    "We have user signal but the team can't agree what it means. Half thinks we need to ship more, half thinks we need to step back."
  ];

  // ── Local State ───────────────────────────────────
  var state = {
    currentPanel: null
  };

  // ── UI: Build the layout ──────────────────────────

  function buildUI() {
    var rightCol = document.querySelector('.fenix-intro-right');
    var leftCol = document.querySelector('.fenix-intro-left');
    if (!rightCol || !leftCol) return;

    rightCol.innerHTML = '';
    leftCol.innerHTML = '';

    buildFenixColumn(rightCol);
    buildUnlockCards(leftCol);

    var zone = document.querySelector('.fenix-intro-zone');
    if (zone) zone.classList.add('pr-zone');

    // The ev-* classes default to opacity:0 and only become visible when
    // .ev-revealed is added (Evaluator does this via scroll-triggered reveal).
    // For Practitioner v1, reveal everything immediately on a short delay
    // so the entrance feels intentional but content is never invisible.
    revealAll();
  }

  function revealAll() {
    var selectors = [
      '.ev-unlock-cards-header',
      '.ev-unlock-card',
      '.ev-fenix-col-header',
      '.ev-fenix-opening-frame'
    ];
    selectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (n) {
        n.classList.add('ev-revealed');
      });
    });
  }

  function buildFenixColumn(container) {
    var colHeader = el('div', 'ev-fenix-col-header', {
      html: 'MEET FENIX — <span class="ev-fenix-tagline">your guide to everything on this site ↘</span>'
    });
    container.appendChild(colHeader);

    var openingFrame = el('div', 'ev-fenix-opening-frame', { text: FENIX_OPENING });
    container.appendChild(openingFrame);
  }

  function buildUnlockCards(container) {
    var cardsWrap = el('div', 'ev-unlock-cards');
    cardsWrap.appendChild(el('div', 'ev-unlock-cards-header', {
      html: 'These features were curated <span class="ev-emphasis">especially</span> for you ↘'
    }));

    var cards = [
      {
        id: 'card-stuck',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>',
        title: 'Tell me where you\'re stuck.',
        tag: 'A tool, free to use',
        hook: 'Most stuck moments aren\'t what they look like. The fix depends on what\'s actually broken.',
        cta: '→ Show me',
        action: 'stuck'
      }
    ];

    cards.forEach(function (card) {
      var cardEl = el('div', 'ev-unlock-card', { 'data-card': card.id });
      cardEl.setAttribute('role', 'button');
      cardEl.setAttribute('tabindex', '0');

      var top = el('div', 'ev-card-top');
      top.appendChild(el('div', 'ev-card-icon', { html: card.icon }));
      var meta = el('div', 'ev-card-meta');
      meta.appendChild(el('div', 'ev-card-title', { text: card.title }));
      meta.appendChild(el('div', 'ev-card-tag', { text: card.tag }));
      top.appendChild(meta);
      cardEl.appendChild(top);

      cardEl.appendChild(el('div', 'ev-card-hook', { text: card.hook }));
      cardEl.appendChild(el('div', 'ev-card-cta', { text: card.cta }));

      cardEl.addEventListener('click', function () {
        cardEl.classList.add('ev-card-visited');
        fenixState.explored.cardsClicked.push(card.id);
        showPanel(card.action);
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

  // ── Panel Management ──────────────────────────────

  function showPanel(panelType) {
    closePanel();
    var zone = document.querySelector('.fenix-intro-zone');
    if (!zone) return;

    var panel = el('div', 'ev-expanded-panel pr-panel-' + panelType);

    switch (panelType) {
      case 'stuck':
        renderStuckPanel(panel);
        break;
      default:
        return;
    }

    state.currentPanel = panelType;
    zone.insertAdjacentElement('afterend', panel);

    requestAnimationFrame(function () {
      panel.classList.add('ev-open');
    });
  }

  function closePanel() {
    var existing = document.querySelector('.ev-expanded-panel');
    if (existing) existing.parentNode.removeChild(existing);
    state.currentPanel = null;
  }

  // ── Stuck Diagnostic Panel ────────────────────────

  function renderStuckPanel(panel) {
    var heading = el('div', 'ev-panel-heading', {
      html: '<em>Fenix:</em> ' + STUCK_LEAD_IN
    });
    panel.appendChild(heading);

    var formWrap = el('div', 'pr-stuck-form');

    var textarea = el('textarea', 'pr-stuck-textarea', {
      placeholder: "Where you're stuck. The more specific, the sharper the diagnosis.",
      rows: '6'
    });
    formWrap.appendChild(textarea);

    var startersWrap = el('div', 'pr-stuck-starters');
    startersWrap.appendChild(el('div', 'pr-stuck-starters-label', { text: 'Not sure where to start? Try one:' }));
    var startersRow = el('div', 'pr-stuck-starters-row');
    STUCK_STARTERS.forEach(function (s) {
      var chip = el('button', 'pr-stuck-chip', {
        type: 'button',
        text: previewLine(s)
      });
      chip.title = s;
      chip.addEventListener('click', function () {
        textarea.value = s;
        textarea.focus();
      });
      startersRow.appendChild(chip);
    });
    startersWrap.appendChild(startersRow);
    formWrap.appendChild(startersWrap);

    var submitBtn = el('button', 'ev-btn-primary pr-stuck-submit', { type: 'button', text: 'Diagnose' });
    submitBtn.addEventListener('click', function () {
      var input = textarea.value.trim();
      if (!input) {
        textarea.focus();
        return;
      }
      handleStuckSubmit(input, panel);
    });
    formWrap.appendChild(submitBtn);

    panel.appendChild(formWrap);
  }

  function previewLine(text) {
    if (text.length <= 50) return text;
    return text.slice(0, 47) + '...';
  }

  // ── Submit handler — streams from CC backend ──────

  function handleStuckSubmit(userInput, panel) {
    var formWrap = panel.querySelector('.pr-stuck-form');
    var submitBtn = panel.querySelector('.pr-stuck-submit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Diagnosing...';
    }

    // Build loading + output area
    var existingOut = panel.querySelector('.pr-stuck-output');
    if (existingOut) existingOut.parentNode.removeChild(existingOut);

    var output = el('div', 'pr-stuck-output');
    var narration = el('div', 'pr-stuck-narration');
    output.appendChild(narration);
    panel.appendChild(output);

    var sections = {};

    fetch(CC_API_BASE + '/api/stuck-diagnostic/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': CC_API_KEY
      },
      body: JSON.stringify({
        user_input: userInput,
        visitor_name: fenixState.visitor.name || null
      })
    }).then(function (resp) {
      if (!resp.ok) throw new Error('Network response was not ok (' + resp.status + ')');
      var reader = resp.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';

      function read() {
        return reader.read().then(function (result) {
          if (result.done) {
            finalizeOutput();
            return;
          }
          buffer += decoder.decode(result.value, { stream: true });
          var lines = buffer.split('\n');
          buffer = lines.pop();

          lines.forEach(function (line) {
            if (line.indexOf('data: ') === 0) {
              var dataStr = line.slice(6);
              try {
                var event = JSON.parse(dataStr);
                handleEvent(event);
              } catch (e) { /* skip malformed */ }
            }
          });
          return read();
        });
      }
      return read();
    }).catch(function (err) {
      console.error('Stuck diagnostic error:', err);
      narration.textContent = 'Something went wrong. Try again in a moment.';
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Diagnose';
      }
    });

    function handleEvent(event) {
      switch (event.type) {
        case 'narration':
          narration.textContent = event.message;
          break;
        case 'diagnosis':
          sections.diagnosis = event;
          renderDiagnosis(output, event);
          break;
        case 'why':
          renderSection(output, 'Why I think so', event.text, 'pr-stuck-why');
          break;
        case 'next_move':
          renderSection(output, 'What I\'d do next', event.text, 'pr-stuck-next');
          break;
        case 'watch_for':
          renderWatchFor(output, event.items);
          break;
        case 'complete':
          finalizeOutput();
          break;
        case 'error':
          narration.textContent = event.message || 'Something went wrong.';
          finalizeOutput();
          break;
      }
    }

    function finalizeOutput() {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Bring me another stuck';
        submitBtn.onclick = function () {
          // Reset for another diagnosis
          panel.querySelector('.pr-stuck-textarea').value = '';
          panel.querySelector('.pr-stuck-textarea').focus();
          var existingOut2 = panel.querySelector('.pr-stuck-output');
          if (existingOut2) existingOut2.parentNode.removeChild(existingOut2);
          submitBtn.textContent = 'Diagnose';
          submitBtn.onclick = null;
          // Re-bind original handler
          submitBtn.addEventListener('click', function () {
            var input = panel.querySelector('.pr-stuck-textarea').value.trim();
            if (!input) return;
            handleStuckSubmit(input, panel);
          }, { once: true });
        };
      }
      // Remove the narration line once we have content (keep it if it shows an error)
      if (Object.keys(sections).length > 0) {
        narration.style.display = 'none';
      }
    }
  }

  function renderDiagnosis(container, event) {
    var box = el('div', 'pr-stuck-diagnosis');
    box.appendChild(el('div', 'pr-stuck-section-label', { text: 'Diagnosis' }));
    box.appendChild(el('div', 'pr-stuck-diagnosis-text', { text: event.text }));
    if (event.secondary) {
      box.appendChild(el('div', 'pr-stuck-secondary-text', { text: event.secondary }));
    }
    container.appendChild(box);
  }

  function renderSection(container, label, text, className) {
    var box = el('div', 'pr-stuck-section ' + className);
    box.appendChild(el('div', 'pr-stuck-section-label', { text: label }));
    box.appendChild(el('div', 'pr-stuck-section-text', { text: text }));
    container.appendChild(box);
  }

  function renderWatchFor(container, items) {
    var box = el('div', 'pr-stuck-section pr-stuck-watch');
    box.appendChild(el('div', 'pr-stuck-section-label', { text: 'What to watch for' }));
    var list = el('ul', 'pr-stuck-watch-list');
    items.forEach(function (item) {
      var li = el('li', null, { text: item });
      list.appendChild(li);
    });
    box.appendChild(list);
    container.appendChild(box);
  }

  // ── Adapter Definition ───────────────────────────

  var practitionerAdapter = {
    persona: 'practitioner',
    accentColor: '#4DAF8B',
    agentUrl: 'https://api.kiranrao.ai/api/v1/fenix/agent',
    messageCap: 30,
    availableTools: ['open_panel', 'close_panel', 'scroll_to_section', 'get_visitor_context', 'connect_visitor', 'collect_feedback', 'show_related_content'],

    buildUI: buildUI,
    showPanel: showPanel,
    openingMessage: FENIX_OPENING,

    onPillAction: function (pill) {
      if (pill.action === 'stuck') {
        showPanel('stuck');
        return true;
      }
      return false;
    }
  };

  // ── Export ───────────────────────────────────────

  window.PractitionerExperience = {
    init: function (persona) {
      if (persona === 'practitioner') {
        FC.init(practitionerAdapter);
      }
    },
    showPanel: showPanel,
    closePanel: closePanel
  };

})();
