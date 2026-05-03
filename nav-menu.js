/* ══════════════════════════════════════════════════
   PERSONA-DRIVEN MOBILE NAV MENU
   ─────────────────────────────────────────────────
   Reads localStorage.persona, reorders the menu's
   9 content destinations to match the bento's
   per-persona reading order. Home is anchored at
   the top (omitted on the homepage), Connect at
   the bottom — both invariant.

   No-JS fallback: each page ships with the default-
   persona ordering as static <li>s inside the
   marker <ul>. If JS doesn't load, the menu still
   works — just not personalized.

   Re-renders when the persona changes (storage
   event from another tab + custom 'persona:changed'
   event from persona-system.js when the picker is
   used in this tab).
   ══════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Canonical card → menu mapping (modern labels) ── */
  var CARD_LABELS = {
    teardowns:    "How I'd've Built It",
    testimonials: 'Testimonials',
    studio:       'Studio',
    madlab:       'MadLab',
    career:       'Receipts',
    underhood:    'Under the Hood',
    skills:       'The Stack',
    blog:         'Blog',
    now:          '/Now'
  };

  var CARD_HREFS = {
    teardowns:    '/how-id-built-it.html',
    testimonials: '/testimonials.html',
    studio:       '/studio.html',
    madlab:       '/madlab.html',
    career:       '/the-work.html',
    underhood:    '/under-the-hood.html',
    skills:       '/skills.html',
    blog:         '/blog-podcast.html',
    now:          '/now.html'
  };

  /* ── Slot reading order (fixed across all personas;
       same as bento's visual top-to-bottom flow) ── */
  var SLOT_ORDER = ['hero', 'topright', 'widel', 'wider', 'tall', 'center', 'skills', 'blog', 'now'];

  /* ── Per-persona slot → card mapping (mirrors bento-cards.js) ── */
  var PERSONAS = {
    'default':      { hero: 'teardowns', topright: 'testimonials', widel: 'studio',    wider: 'madlab',        tall: 'career',     center: 'underhood',    skills: 'skills',       blog: 'blog',      now: 'now' },
    'evaluator':    { hero: 'career',    topright: 'testimonials', widel: 'studio',    wider: 'madlab',        tall: 'teardowns',  center: 'underhood',    skills: 'skills',       blog: 'blog',      now: 'now' },
    'seeker':       { hero: 'career',    topright: 'teardowns',    widel: 'studio',    wider: 'underhood',     tall: 'madlab',     center: 'testimonials', skills: 'skills',       blog: 'blog',      now: 'now' },
    'practitioner': { hero: 'teardowns', topright: 'career',       widel: 'studio',    wider: 'testimonials',  tall: 'madlab',     center: 'underhood',    skills: 'skills',       blog: 'blog',      now: 'now' },
    'learner':      { hero: 'blog',      topright: 'skills',       widel: 'studio',    wider: 'madlab',        tall: 'teardowns',  center: 'career',       skills: 'testimonials', blog: 'underhood', now: 'now' },
    'technologist': { hero: 'madlab',    topright: 'studio',       widel: 'underhood', wider: 'career',        tall: 'teardowns',  center: 'testimonials', skills: 'skills',       blog: 'blog',      now: 'now' },
    'innercircle':  { hero: 'studio',    topright: 'career',       widel: 'teardowns', wider: 'testimonials',  tall: 'madlab',     center: 'underhood',    skills: 'skills',       blog: 'blog',      now: 'now' }
  };

  /* ── Helpers ── */
  function getPersona() {
    try { return localStorage.getItem('persona') || 'default'; }
    catch (e) { return 'default'; }
  }

  function isHomepage() {
    var p = window.location.pathname;
    return p === '/' || p === '/index.html';
  }

  function buildMenuItems(persona) {
    var slotMap = PERSONAS[persona] || PERSONAS['default'];
    var items = [];

    // Home (always first, skip on homepage)
    if (!isHomepage()) {
      items.push({ href: '/index.html', label: 'Home' });
    }

    // 9 dynamic content items in slot reading order
    SLOT_ORDER.forEach(function (slot) {
      var cardId = slotMap[slot];
      if (!cardId || !CARD_LABELS[cardId]) return;
      items.push({ href: CARD_HREFS[cardId], label: CARD_LABELS[cardId] });
    });

    // Connect (always last)
    items.push({ href: '/index.html#contact', label: 'Connect' });

    return items;
  }

  function renderMenu(ul, items) {
    var html = items.map(function (item) {
      // ↘ glyph matches the existing menu visual style
      return '<li><a href="' + item.href + '">&#8600; ' + item.label + '</a></li>';
    }).join('');
    ul.innerHTML = html;
  }

  function refresh() {
    var menus = document.querySelectorAll('ul.mobile-nav-links[data-canonical-menu]');
    if (!menus.length) return;
    var persona = getPersona();
    var items = buildMenuItems(persona);
    menus.forEach(function (ul) { renderMenu(ul, items); });
  }

  /* ── Wire up ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refresh);
  } else {
    refresh();
  }

  // Re-render when persona changes in another tab
  window.addEventListener('storage', function (e) {
    if (e.key === 'persona' || e.key === null) refresh();
  });

  // Re-render when persona-system.js fires a change in this tab
  window.addEventListener('persona:changed', refresh);

  // Re-render right before the menu opens (catches stale state if the
  // user changed persona without navigating)
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t && t.id === 'menuButton') refresh();
  });

  // Expose for any other surface that needs it
  window.NavMenu = { refresh: refresh, buildMenuItems: buildMenuItems };
})();
