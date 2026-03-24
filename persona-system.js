// ============================================
// PERSONA SYSTEM — Foundation + All Personalization
// Reads localStorage, sets CSS custom properties,
// drives nav pill, about personalization, competency
// reorder, card reorder, tagline swap, section labels,
// and morph choreography.
// ============================================

(function () {
  'use strict';

  // ── Persona Config ──────────────────────────────────
  const PERSONA_CONFIG = {
    evaluator: {
      accent: '#7B9ACC',
      name: 'The Evaluator',
      character: 'Merritt Hunter',
      title: 'Recruiter / Hiring Manager',
      tagline: 'Builder of Products People Love',
      introLine: 'Equal parts strategist, storyteller, and builder.',
      description: '', // Kiran writes these
      socialLinks: ['linkedin', 'github', 'substack'],
      competencyOrder: ['Product Strategy', 'Go-to-Market Strategy', 'Delivery & Execution', 'Growth & Adoption', 'AI Integration', 'Digital Transformation'],
      cardOrder: ['my-work', 'how-id-built-it', 'blog-podcast', 'my-sandbox', 'creative-lab', 'certifications', 'causes', 'store'],
      contactSubtext: "I'd love to hear about the role.",
      fenixTooltip: 'Curious about my product experience? Ask me anything.',
      unlocks: [
        { label: 'Book a conversation', desc: 'Schedule a 30-min intro call directly.', icon: 'calendar', link: '#' },
        { label: 'Download my resume', desc: 'A polished, ready-to-forward resume.', icon: 'download', link: '#' },
        { label: 'References on request', desc: 'Curated reference sheet with context.', icon: 'users', link: '#' }
      ]
    },
    seeker: {
      accent: '#8A8580',
      name: 'The Seeker',
      character: 'Phil Thevoid',
      title: 'Founder / Needs a Product Leader',
      tagline: 'Builder Who Turns Vision into Product',
      introLine: 'Equal parts strategist, operator, and builder.',
      description: '',
      socialLinks: ['linkedin', 'github'],
      competencyOrder: ['Go-to-Market Strategy', 'Product Strategy', 'Growth & Adoption', 'Delivery & Execution', 'AI Integration', 'Digital Transformation'],
      cardOrder: ['my-work', 'my-sandbox', 'how-id-built-it', 'blog-podcast', 'creative-lab', 'certifications', 'causes', 'store'],
      contactSubtext: 'Tell me what you\'re building.',
      fenixTooltip: 'Tell me what you\'re building — I\'ll show you how I\'d think about it.',
      unlocks: [
        { label: 'Bring your problem', desc: 'Describe what you\'re building. Fenix walks through the framing.', icon: 'lightbulb', link: '#' },
        { label: 'Fractional engagement brief', desc: 'What 10 hrs/week of product leadership looks like.', icon: 'file-text', link: '#' },
        { label: 'Founder case studies', desc: 'How I\'ve helped founders ship from 0 to 1.', icon: 'briefcase', link: '#' }
      ]
    },
    practitioner: {
      accent: '#4DAF8B',
      name: 'The Practitioner',
      character: 'Drew Skematics',
      title: 'Product · Design · Data',
      tagline: 'Builder Who Thinks in Tradeoffs',
      introLine: 'Equal parts analyst, craftsperson, and builder.',
      description: '',
      socialLinks: ['linkedin', 'substack', 'github'],
      competencyOrder: ['Product Strategy', 'AI Integration', 'Go-to-Market Strategy', 'Digital Transformation', 'Growth & Adoption', 'Delivery & Execution'],
      cardOrder: ['how-id-built-it', 'my-sandbox', 'my-work', 'blog-podcast', 'creative-lab', 'certifications', 'causes', 'store'],
      contactSubtext: "I'm always up for a product debate.",
      fenixTooltip: 'Want the reasoning behind a specific teardown? Let\'s dig in.',
      unlocks: [
        { label: 'The teardown vault', desc: 'Director\'s commentary on teardowns — the dead ends and raw thinking.', icon: 'archive', link: '#' },
        { label: 'Roast my product', desc: 'Submit a URL. Get a Kiran-style quick teardown.', icon: 'zap', link: '#' },
        { label: 'Frameworks & mental models', desc: 'The actual tools I use for prioritization and analysis.', icon: 'layout', link: '#' }
      ]
    },
    learner: {
      accent: '#A07ED4',
      name: 'The Learner',
      character: 'Paige Turner',
      title: 'Aspiring PM / Career Grower',
      tagline: 'Builder Who Thinks Out Loud',
      introLine: 'Equal parts storyteller, teacher, and builder.',
      description: '',
      socialLinks: ['linkedin', 'substack'],
      competencyOrder: ['Growth & Adoption', 'Product Strategy', 'AI Integration', 'Go-to-Market Strategy', 'Digital Transformation', 'Delivery & Execution'],
      cardOrder: ['blog-podcast', 'how-id-built-it', 'certifications', 'my-sandbox', 'my-work', 'creative-lab', 'causes', 'store'],
      contactSubtext: 'Happy to chat about your PM journey.',
      fenixTooltip: 'Got a PM interview coming up? I can help you prep.',
      unlocks: [
        { label: 'Book a mentorship session', desc: 'Free 30-min call via ADPList.', icon: 'message-circle', link: '#' },
        { label: 'PM starter kit', desc: 'Curated reading list, frameworks, and interview prep.', icon: 'book-open', link: '#' },
        { label: 'Ask me about breaking in', desc: 'Fenix in mentorship mode — career transition help.', icon: 'compass', link: '#' }
      ]
    },
    technologist: {
      accent: '#cb5c72',
      name: 'The Technologist',
      character: 'Ray Turing',
      title: 'CTO / AI Lead / Tech Lead',
      tagline: 'Builder Who Ships with AI',
      introLine: 'Equal parts tinkerer, systems thinker, and builder.',
      description: '',
      socialLinks: ['linkedin', 'github'],
      competencyOrder: ['AI Integration', 'Product Strategy', 'Digital Transformation', 'Delivery & Execution', 'Go-to-Market Strategy', 'Growth & Adoption'],
      cardOrder: ['my-sandbox', 'how-id-built-it', 'creative-lab', 'my-work', 'blog-podcast', 'certifications', 'causes', 'store'],
      contactSubtext: "Let's geek out.",
      fenixTooltip: 'Want to see how I built this site with AI? Ask me.',
      unlocks: [
        { label: 'The GitHub tour', desc: 'Real repos behind this site — Fenix RAG, persona picker, and more.', icon: 'github', link: '#' },
        { label: 'Architecture decision records', desc: 'Why vanilla JS, why Supabase + pgvector, why Cloudflare.', icon: 'layers', link: '#' },
        { label: 'Pair with me', desc: '45-min technical pairing session. Pick a problem.', icon: 'code', link: '#' }
      ]
    },
    innercircle: {
      accent: '#cb6923',
      name: 'The Inner Circle',
      character: 'Keshav Shivdasani',
      title: 'Old Friend',
      tagline: 'Builder of Weird and Wonderful Things',
      introLine: 'Equal parts overthinker, dreamer, and builder.',
      description: '',
      socialLinks: ['linkedin'],
      competencyOrder: null, // no reorder
      cardOrder: ['creative-lab', 'my-sandbox', 'causes', 'blog-podcast', 'my-work', 'how-id-built-it', 'certifications', 'store'],
      contactSubtext: 'You already have my number.',
      fenixTooltip: "Hey — Flame On is already turned on for you.",
      unlocks: [
        { label: 'Flame On by default', desc: 'Fenix skips the polish — raw journal entries, half-baked ideas.', icon: 'flame', link: '#' },
        { label: "What I'm actually working on", desc: 'Live-ish view of current projects. The real status.', icon: 'activity', link: '#' },
        { label: 'Direct line', desc: 'WhatsApp. No forms.', icon: 'phone', link: '#' }
      ]
    }
  };

  // ── Foundation: Read localStorage, Set CSS Variable ──
  function getPersona() {
    return localStorage.getItem('persona') || null;
  }

  function getPersonaAccent() {
    return localStorage.getItem('persona-accent') || null;
  }

  function getPersonaConfig(persona) {
    return persona ? PERSONA_CONFIG[persona] || null : null;
  }

  function applyAccentVariable() {
    var accent = getPersonaAccent();
    if (accent) {
      document.documentElement.style.setProperty('--persona-accent', accent);
    }
    // When no persona, --persona-accent stays unset — CSS fallbacks handle neutral defaults
  }

  // ── C1: Nav — Viewing As Pill ──────────────────────
  function buildViewingAsPill() {
    var nav = document.querySelector('.nav-container');
    if (!nav) return;

    // Create left side of nav for the pill
    var navLeft = document.createElement('div');
    navLeft.className = 'nav-left';

    var pill = document.createElement('button');
    pill.className = 'viewing-as-pill';
    pill.setAttribute('aria-label', 'Change persona');

    var persona = getPersona();
    var config = getPersonaConfig(persona);

    if (config) {
      pill.innerHTML = '<span class="pill-label">Viewing as</span> <span class="pill-persona-name">' + config.name + '</span>';
      pill.style.borderColor = config.accent;
      pill.querySelector('.pill-persona-name').style.color = config.accent;
      pill.addEventListener('click', function () {
        triggerMorphReverse();
      });
    } else {
      pill.innerHTML = '<span class="pill-label">Choose your lens</span> <span class="pill-action">pick</span>';
      pill.classList.add('unpicked');
      pill.addEventListener('click', function () {
        showPickerMode();
      });
    }

    navLeft.appendChild(pill);

    // Insert navLeft before navRight
    var navRight = nav.querySelector('.nav-right');
    nav.insertBefore(navLeft, navRight);
  }

  // ── C1: Accent Frame ───────────────────────────────
  function applyAccentFrame() {
    var accent = getPersonaAccent();
    if (!accent) return;

    // Add accent-frame-medium class to body by default
    // Can switch to accent-frame-full for comparison
    document.body.classList.add('accent-frame-medium');
    // document.body.classList.add('accent-frame-full');
  }

  // ── C2: Single-Page Morph ──────────────────────────
  function initMorph() {
    var persona = getPersona();

    if (persona) {
      // Returning visitor: skip to final state
      document.body.classList.add('persona-active');
      document.body.classList.add('morph-complete');
      var pickerSection = document.getElementById('persona-picker-section');
      if (pickerSection) pickerSection.style.display = 'none';
    } else {
      // First-time visitor: show picker mode
      document.body.classList.add('picker-mode');
    }

    // Keyboard support for inline picker cards
    var inlineCards = document.querySelectorAll('.persona-card-inline');
    inlineCards.forEach(function (card) {
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          window.selectPersonaAndMorph(card);
        }
      });
    });
  }

  function showPickerMode() {
    document.body.classList.remove('persona-active', 'morph-complete');
    document.body.classList.add('picker-mode');
    var pickerSection = document.getElementById('persona-picker-section');
    if (pickerSection) {
      pickerSection.style.display = '';
      pickerSection.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // Called when a persona card is selected
  window.selectPersonaAndMorph = function (cardEl) {
    var persona = cardEl.dataset.persona;
    var accent = cardEl.dataset.accent;

    // Store selection
    localStorage.setItem('persona', persona);
    localStorage.setItem('persona-accent', accent);

    // Set CSS variable immediately
    document.documentElement.style.setProperty('--persona-accent', accent);

    // Apply persona data to all components before morph
    applyAllPersonalization(persona);

    // Start morph choreography
    startMorphTransition(persona, accent);
  };

  function startMorphTransition(persona, accent) {
    var config = getPersonaConfig(persona);
    var body = document.body;
    var pickerSection = document.getElementById('persona-picker-section');

    // ── Act 1: Cards dissolve with staggered blur (450ms total) ──
    body.classList.add('morph-cards-exit');

    // Smooth scroll to top during card exit
    window.scrollTo({ top: 0, behavior: 'smooth' });

    setTimeout(function () {
      // Snap to top before reveal
      window.scrollTo({ top: 0, behavior: 'instant' });

      // Hide picker section
      if (pickerSection) pickerSection.style.display = 'none';

      // Perform the DOM state change — use View Transitions API if available
      var doReveal = function () {
        // Switch body state
        body.classList.remove('picker-mode', 'morph-cards-exit');
        body.classList.add('persona-active', 'accent-frame-medium');

        // ── Act 2: Above-fold reveal (nav, accent border, hero text) ──
        body.classList.add('morph-reveal', 'morph-accent-draw');

        // Update nav pill
        updateNavPill(config);

        // Toast after pill lands
        setTimeout(function () {
          showPersonaToast(config);
        }, 350);

        // ── Act 3: Below-fold content materializes (staggered) ──
        setTimeout(function () {
          body.classList.add('morph-content-in');

          // ── Cleanup: remove animation classes, settle to final state ──
          setTimeout(function () {
            body.classList.remove('morph-reveal', 'morph-accent-draw', 'morph-content-in');
            body.classList.add('morph-complete');
          }, 700);
        }, 400);
      };

      // Use View Transitions API for the big state swap (if supported)
      if (document.startViewTransition) {
        document.startViewTransition(doReveal);
      } else {
        doReveal();
      }

    }, 550); // Wait for card dissolve + scroll
  }

  function triggerMorphReverse() {
    // Clear persona
    localStorage.removeItem('persona');
    localStorage.removeItem('persona-accent');
    document.documentElement.style.removeProperty('--persona-accent');

    // Reset body classes
    document.body.classList.remove('persona-active', 'morph-complete', 'morph-reveal', 'morph-accent-draw', 'morph-content-in', 'accent-frame-medium', 'accent-frame-full');
    document.body.classList.add('morph-reverse');

    // Show picker
    var pickerSection = document.getElementById('persona-picker-section');
    if (pickerSection) pickerSection.style.display = '';

    // Deselect all cards
    document.querySelectorAll('#persona-picker-section .card').forEach(function (c) {
      c.classList.remove('selected');
    });

    // Update nav pill to unpicked state
    var pill = document.querySelector('.viewing-as-pill');
    if (pill) {
      pill.innerHTML = '<span class="pill-label">Choose your lens</span> <span class="pill-action">pick</span>';
      pill.classList.add('unpicked');
      pill.style.borderColor = '';
    }

    // Reset personalization to defaults
    resetPersonalization();

    setTimeout(function () {
      document.body.classList.remove('morph-reverse');
      document.body.classList.add('picker-mode');
      if (pickerSection) pickerSection.scrollIntoView({ behavior: 'smooth' });
    }, 600);
  }

  function updateNavPill(config) {
    var pill = document.querySelector('.viewing-as-pill');
    if (!pill) return;
    pill.innerHTML = '<span class="pill-label">Viewing as</span> <span class="pill-persona-name">' + config.name + '</span>';
    pill.classList.remove('unpicked');
    pill.style.borderColor = config.accent;
    var nameEl = pill.querySelector('.pill-persona-name');
    if (nameEl) nameEl.style.color = config.accent;

    // Rebind click
    pill.onclick = function () { triggerMorphReverse(); };
  }

  function showPersonaToast(config) {
    var toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = '';
    toast.innerHTML = 'Viewing as <span style="color:' + config.accent + '; font-weight: 600;">' + config.name + '</span>';
    toast.classList.add('visible');
    if (config.accent) {
      toast.style.borderColor = config.accent;
    }
    setTimeout(function () {
      toast.classList.remove('visible');
      toast.style.borderColor = '';
    }, 3500);
  }

  // ── C3: About Personalization ──────────────────────
  function applyAboutPersonalization(persona) {
    var config = getPersonaConfig(persona);
    if (!config) return;

    // Tagline swap (1.1)
    var tagline = document.querySelector('.hero-tagline');
    if (tagline && config.tagline) {
      tagline.textContent = config.tagline;
      // Hero tagline in accent color (from Implemented table)
      tagline.style.color = config.accent;
    }

    // About intro line swap (1.2)
    var introLine = document.querySelector('.about-intro');
    if (introLine && config.introLine) {
      introLine.textContent = config.introLine;
    }

    // About description swap (only if Kiran has provided copy)
    var desc = document.querySelector('.about-description');
    if (desc && config.description) {
      desc.textContent = config.description;
    }

    // Social links personalization
    applySocialLinks(config.socialLinks);

    // Competency reorder (1.3)
    applyCompetencyReorder(config.competencyOrder);

    // Card reorder (1.4)
    applyCardReorder(config.cardOrder);

    // Contact CTA subtext (1.7)
    applyContactSubtext(config.contactSubtext);
  }

  function applySocialLinks(links) {
    if (!links || !links.length) return;
    var container = document.querySelector('.about-right .social-links');
    if (!container) return;
    var allLinks = container.querySelectorAll('.wf-social-icon');
    allLinks.forEach(function (link) {
      var isLinkedin = link.classList.contains('linkedin');
      var isGithub = link.classList.contains('github');
      var isSubstack = link.classList.contains('substack');

      var type = isLinkedin ? 'linkedin' : isGithub ? 'github' : isSubstack ? 'substack' : '';
      if (type && links.indexOf(type) === -1) {
        link.style.display = 'none';
      } else {
        link.style.display = '';
      }
    });
  }

  function applyCompetencyReorder(order) {
    if (!order || !order.length) return;
    var grid = document.querySelector('.competencies-grid');
    if (!grid) return;

    var tiles = Array.from(grid.children);
    var tileMap = {};
    tiles.forEach(function (tile) {
      var title = tile.querySelector('.competency-title');
      if (title) tileMap[title.textContent.trim()] = tile;
    });

    // Reorder
    order.forEach(function (name) {
      if (tileMap[name]) grid.appendChild(tileMap[name]);
    });
  }

  function applyCardReorder(order) {
    if (!order || !order.length) return;
    var grid = document.querySelector('.work-grid');
    if (!grid) return;

    var cards = Array.from(grid.children);
    var cardMap = {};
    cards.forEach(function (card) {
      cardMap[card.id] = card;
    });

    order.forEach(function (id) {
      if (cardMap[id]) grid.appendChild(cardMap[id]);
    });
  }

  function applyContactSubtext(text) {
    if (!text) return;
    var contact = document.querySelector('.contact-cta');
    if (!contact) return;
    var existing = contact.querySelector('.contact-subtext');
    if (existing) {
      existing.textContent = text;
    } else {
      var h2 = contact.querySelector('h2');
      if (h2) {
        var p = document.createElement('p');
        p.className = 'contact-subtext';
        p.textContent = text;
        h2.insertAdjacentElement('afterend', p);
      }
    }
  }

  function resetPersonalization() {
    // Reset tagline
    var tagline = document.querySelector('.hero-tagline');
    if (tagline) {
      tagline.textContent = 'Builder of Products People Love';
      tagline.style.color = '';
    }

    // Reset intro line
    var introLine = document.querySelector('.about-intro');
    if (introLine) introLine.textContent = 'Equal parts strategist, storyteller, and builder.';

    // Reset social links — show all
    var socialLinks = document.querySelectorAll('.about-right .social-links .wf-social-icon');
    socialLinks.forEach(function (link) { link.style.display = ''; });

    // Remove contact subtext
    var subtext = document.querySelector('.contact-subtext');
    if (subtext) subtext.remove();

    // Note: competency and card reorder would need page reload to fully reset
    // This is acceptable since the user is switching personas which involves a morph
  }

  // ── Apply All Personalization ──────────────────────
  function applyAllPersonalization(persona) {
    if (!persona) return;
    applyAboutPersonalization(persona);
    applyAccentVariable();
    applyAccentFrame();
    buildFenixIntroContent(persona);
  }

  // ── C4: Fenix Intro Shell — Build Content ──────────
  function buildFenixIntroContent(persona) {
    var config = getPersonaConfig(persona);
    if (!config) return;

    // Left column: unlocks
    var unlocksList = document.querySelector('.fenix-intro-unlocks');
    if (unlocksList && config.unlocks) {
      unlocksList.innerHTML = '';
      var heading = document.createElement('p');
      heading.className = 'unlock-heading';
      heading.innerHTML = 'As <span style="color:' + config.accent + '">' + config.name + '</span>, here\'s what\'s unlocked:';
      unlocksList.appendChild(heading);

      config.unlocks.forEach(function (unlock) {
        var item = document.createElement('a');
        item.className = 'unlock-item';
        item.href = unlock.link;
        item.innerHTML = '<span class="unlock-label">' + unlock.label + '</span><span class="unlock-desc">' + unlock.desc + '</span>';
        unlocksList.appendChild(item);
      });
    }

    // Right column: Fenix greeting
    var fenixGreeting = document.querySelector('.fenix-intro-greeting');
    if (fenixGreeting && config.fenixTooltip) {
      fenixGreeting.textContent = config.fenixTooltip;
    }

    // Suggestion chips
    var chipsContainer = document.querySelector('.fenix-intro-chips');
    if (chipsContainer) {
      // Chips are persona-specific — keep generic for now, Kiran fills in
      chipsContainer.innerHTML = '';
      var defaultChips = ['Tell me about Kiran', 'Show me your work', 'What makes you different?'];
      defaultChips.forEach(function (text) {
        var chip = document.createElement('button');
        chip.className = 'fenix-chip';
        chip.textContent = text;
        chip.addEventListener('click', function () {
          if (typeof window.launchFenixWithMessage === 'function') {
            window.launchFenixWithMessage(text);
          } else if (typeof window.launchFenix === 'function') {
            window.launchFenix();
          }
        });
        chipsContainer.appendChild(chip);
      });
    }
  }

  // ── C7: Footer Quotes ──────────────────────────────
  // Kiran populates this array
  var QUOTES = [
    // { text: "Quote text here", source: "Source" }
  ];

  function buildFooterQuotes() {
    var container = document.querySelector('.footer-quotes');
    if (!container || !QUOTES.length) return;

    // Pick a random quote
    var quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    container.innerHTML = '<blockquote class="footer-quote-text">"' + quote.text + '"</blockquote>' +
      (quote.source ? '<cite class="footer-quote-source">— ' + quote.source + '</cite>' : '');
  }

  // ── C8: Fenix Subpage Module ───────────────────────
  function initFenixSubpageModule() {
    // Only on subpages (not index.html)
    if (window.location.pathname === '/' || window.location.pathname.endsWith('index.html')) return;

    var persona = getPersona();
    var config = getPersonaConfig(persona);

    // Create module container
    var module = document.createElement('div');
    module.id = 'fenix-subpage-module';

    // Build full module (default)
    module.className = 'fenix-subpage-module fenix-subpage-full';
    module.innerHTML =
      '<div class="fenix-subpage-inner">' +
        '<div class="fenix-subpage-logo-wrap">' +
          '<img src="images/logo.png" alt="Fenix" class="fenix-subpage-logo">' +
        '</div>' +
        '<div class="fenix-subpage-content">' +
          '<p class="fenix-subpage-greeting">' + (config ? config.fenixTooltip : 'Need help exploring? I\'m here.') + '</p>' +
          '<div class="fenix-subpage-chips"></div>' +
        '</div>' +
        '<button class="fenix-subpage-dismiss" aria-label="Dismiss Fenix module">&times;</button>' +
      '</div>';

    // Insert after nav
    var nav = document.querySelector('nav');
    if (nav && nav.nextSibling) {
      nav.parentNode.insertBefore(module, nav.nextSibling);
    }

    // Add chips
    var chipsEl = module.querySelector('.fenix-subpage-chips');
    var pageName = document.title.split(' - ')[0] || 'this page';
    var chips = ['Tell me about ' + pageName, 'What should I look at first?'];
    chips.forEach(function (text) {
      var chip = document.createElement('button');
      chip.className = 'fenix-chip';
      chip.textContent = text;
      chip.addEventListener('click', function () {
        if (typeof window.launchFenixWithMessage === 'function') {
          window.launchFenixWithMessage(text);
        } else if (typeof window.launchFenix === 'function') {
          window.launchFenix();
        }
      });
      chipsEl.appendChild(chip);
    });

    // Dismiss behavior → collapse to FAB
    var dismissBtn = module.querySelector('.fenix-subpage-dismiss');
    dismissBtn.addEventListener('click', function () {
      module.classList.add('dismissed');
      // FAB gets accent ring (handled via CSS)
    });

    // Slim bar variant (switchable via class)
    // To test slim: module.className = 'fenix-subpage-module fenix-subpage-slim';

    // Auto-collapse on scroll (for slim bar)
    var scrollThreshold = 200;
    var didScroll = false;
    window.addEventListener('scroll', function () {
      if (!didScroll && window.scrollY > scrollThreshold && module.classList.contains('fenix-subpage-slim')) {
        module.classList.add('auto-collapsed');
        didScroll = true;
      }
    }, { passive: true });
  }

  // ── C8: FAB Accent Ring ────────────────────────────
  function applyFabAccentRing() {
    var accent = getPersonaAccent();
    if (!accent) return;
    var fab = document.querySelector('.ai-assistant');
    if (!fab) return;
    fab.classList.add('persona-accent-ring');
  }

  // ── C9: Toast Accent Border ────────────────────────
  // Handled via CSS: .toast gets border-color from --persona-accent when persona is active

  // ── Section Label Accent ───────────────────────────
  // Handled via CSS: .section-label gets color from --persona-accent

  // ── Initialize Everything ──────────────────────────
  function init() {
    // Foundation
    applyAccentVariable();

    var persona = getPersona();

    // Build nav pill
    buildViewingAsPill();

    if (persona) {
      // Apply frame
      applyAccentFrame();
      // Apply all personalization
      applyAllPersonalization(persona);
      // FAB accent ring
      applyFabAccentRing();
    }

    // Init morph state
    initMorph();

    // Footer quotes
    buildFooterQuotes();

    // Fenix subpage module (only on subpages)
    initFenixSubpageModule();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for external use
  window.PersonaSystem = {
    getPersona: getPersona,
    getConfig: getPersonaConfig,
    PERSONA_CONFIG: PERSONA_CONFIG,
    triggerMorphReverse: triggerMorphReverse,
    showPickerMode: showPickerMode
  };

})();
