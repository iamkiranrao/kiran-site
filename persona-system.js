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
      image: 'images/evaluator-merritt.webp',
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
      ],
      metrics: [
        { value: '~6 wks', label: 'First commit → live site' },
        { value: '25', label: 'Architectural components' },
        { value: '3', label: 'AI systems built in' },
        { value: '7', label: 'APIs integrated' },
        { value: '0', label: 'Frameworks used' },
        { value: '0', label: 'Meetings required to ship' }
      ]
    },
    seeker: {
      accent: '#8A8580',
      name: 'The Seeker',
      image: 'images/seeker-phil.webp',
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
      ],
      metrics: [
        { value: '0', label: 'Frameworks — just HTML, CSS, JS' },
        { value: '199', label: 'Commits, one at a time' },
        { value: '4,279', label: 'Lines of CSS, by hand' },
        { value: '3', label: 'AI systems wired in' },
        { value: '0', label: 'Times I asked for permission' }
      ]
    },
    practitioner: {
      accent: '#4DAF8B',
      name: 'The Practitioner',
      image: 'images/practitioner-drew.webp',
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
      ],
      metrics: [
        { value: '6', label: 'Persona lenses' },
        { value: '25', label: 'Architectural components' },
        { value: '23', label: 'Choreographed animations' },
        { value: '730+', label: 'Accessibility markers' },
        { value: '0', label: 'Jira tickets filed' }
      ]
    },
    learner: {
      accent: '#A07ED4',
      name: 'The Learner',
      image: 'images/learner-paige.webp',
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
      ],
      metrics: [
        { value: '0', label: 'Frameworks — just HTML, CSS, JS' },
        { value: '3', label: 'AI systems to explore' },
        { value: '7', label: 'APIs you can trace' },
        { value: '2,414', label: 'Lines of JS, all readable' },
        { value: '1,000+', label: "console.log('why??') calls" }
      ]
    },
    technologist: {
      accent: '#cb5c72',
      name: 'The Technologist',
      image: 'images/technologist-ray.webp',
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
      ],
      metrics: [
        { value: '3', label: 'AI systems (RAG + embeddings + SSE)' },
        { value: '7', label: 'APIs integrated' },
        { value: '25', label: 'Components, zero dependencies' },
        { value: '18', label: 'CSS design tokens' },
        { value: '730+', label: 'A11y markers across 43 files' },
        { value: '0', label: 'node_modules folders' }
      ]
    },
    innercircle: {
      accent: '#cb6923',
      name: 'The Inner Circle',
      image: 'images/innercircle-keshav.webp',
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
      ],
      metrics: [
        { value: '199', label: 'Commits since February' },
        { value: '~6 wks', label: 'Start to what you\'re looking at' },
        { value: '70', label: 'Hand-picked assets' },
        { value: '3am', label: 'Average commit time' },
        { value: '0', label: 'Weekends off since February' }
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
      var avatarHtml = config.image ? '<span class="pill-avatar-wrap"><img class="pill-avatar" src="' + config.image + '" alt="' + config.character + '"></span>' : '';
      pill.innerHTML = avatarHtml + '<span class="pill-label">Viewing as</span> <span class="pill-persona-name">' + config.name + '</span>';
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

    var pickerSection = document.getElementById('persona-picker-section');

    if (persona) {
      // Returning visitor: skip to final state
      document.body.classList.add('persona-active');
      document.body.classList.add('morph-complete');
      if (pickerSection) pickerSection.style.display = 'none';
    } else if (pickerSection) {
      // First-time visitor on homepage: show picker mode
      document.body.classList.add('picker-mode');
    }
    // Subpages without picker: nav stays visible, no picker-mode applied

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
    var pickerSection = document.getElementById('persona-picker-section');
    if (!pickerSection) {
      // On subpages: redirect to homepage picker instead of hiding nav
      localStorage.removeItem('persona');
      localStorage.removeItem('persona-accent');
      window.location.href = 'index.html';
      return;
    }
    document.body.classList.remove('persona-active', 'morph-complete');
    document.body.classList.add('picker-mode');
    pickerSection.style.display = '';
    pickerSection.scrollIntoView({ behavior: 'smooth' });
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

    // ── Act 1: Cards dissolve with staggered blur ──
    // Last card starts at 0.45s + 0.6s duration = ~1.05s total
    body.classList.add('morph-cards-exit');

    // Smooth scroll to top during card exit
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // ── Dramatic pause: wait for cards to fully dissolve + scroll ──
    setTimeout(function () {
      // Snap to top
      window.scrollTo({ top: 0, behavior: 'instant' });

      // Hide picker section
      if (pickerSection) pickerSection.style.display = 'none';

      // ── Beat: 300ms of just the hero image. Stillness. ──
      body.classList.remove('morph-cards-exit');

      setTimeout(function () {
        // Perform the DOM state change
        var doReveal = function () {
          // Switch body state
          body.classList.remove('picker-mode');
          body.classList.add('persona-active', 'accent-frame-medium');

          // ── Act 2: Above-fold reveal ──
          // Accent border draws first (1s), nav drops at 0.2s,
          // pill at 0.5s, name at 0.35s, tagline at 0.7s, location at 1.05s
          body.classList.add('morph-reveal', 'morph-accent-draw');

          // Update nav pill content (will animate in via CSS delay)
          updateNavPill(config);

          // Toast AFTER the tagline has landed — the tagline is the payoff
          setTimeout(function () {
            showPersonaToast(config, true);
          }, 1200);

          // ── Beat: let above-fold breathe before below-fold ──
          setTimeout(function () {
            // ── Act 3: Below-fold content materializes ──
            body.classList.add('morph-content-in');

            // ── Cleanup after all animations settle ──
            setTimeout(function () {
              body.classList.remove('morph-reveal', 'morph-accent-draw', 'morph-content-in');
              body.classList.add('morph-complete');
            }, 1200);
          }, 1600);
        };

        // Use View Transitions API for the state swap
        if (document.startViewTransition) {
          document.startViewTransition(doReveal);
        } else {
          doReveal();
        }

      }, 300); // 300ms beat of stillness

    }, 1100); // Wait for card cascade to finish (0.45s delay + 0.6s anim)
  }

  function triggerMorphReverse() {
    // Clear persona
    localStorage.removeItem('persona');
    localStorage.removeItem('persona-accent');
    document.documentElement.style.removeProperty('--persona-accent');

    // On subpages: redirect to homepage picker
    var pickerSection = document.getElementById('persona-picker-section');
    if (!pickerSection) {
      window.location.href = 'index.html';
      return;
    }

    // Reset body classes
    document.body.classList.remove('persona-active', 'morph-complete', 'morph-reveal', 'morph-accent-draw', 'morph-content-in', 'accent-frame-medium', 'accent-frame-full');
    document.body.classList.add('morph-reverse');

    // Show picker
    pickerSection.style.display = '';

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
    var avatarHtml = config.image ? '<span class="pill-avatar-wrap"><img class="pill-avatar" src="' + config.image + '" alt="' + config.character + '"></span>' : '';
    pill.innerHTML = avatarHtml + '<span class="pill-label">Viewing as</span> <span class="pill-persona-name">' + config.name + '</span>';
    pill.classList.remove('unpicked');
    pill.style.borderColor = config.accent;
    var nameEl = pill.querySelector('.pill-persona-name');
    if (nameEl) nameEl.style.color = config.accent;

    // Rebind click
    pill.onclick = function () { triggerMorphReverse(); };
  }

  function showPersonaToast(config, fromMorph) {
    var toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = '';
    toast.innerHTML = 'Viewing as <span style="color:' + config.accent + '; font-weight: 600;">' + config.name + '</span>';
    if (fromMorph) {
      toast.classList.add('toast-morph');
    }
    toast.classList.add('visible');
    if (config.accent) {
      toast.style.borderColor = config.accent;
    }
    setTimeout(function () {
      toast.classList.remove('visible');
      toast.style.borderColor = '';
      setTimeout(function () {
        toast.classList.remove('toast-morph');
      }, 300);
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
    buildNumbersGrid(persona);
  }

  // ── C11: What It Took — Persona-specific metrics ──
  function buildNumbersGrid(persona) {
    var grid = document.getElementById('numbers-grid');
    if (!grid) return;

    var config = getPersonaConfig(persona);
    if (!config || !config.metrics) return;

    grid.innerHTML = '';
    config.metrics.forEach(function (metric) {
      var card = document.createElement('div');
      card.className = 'number-card';
      card.innerHTML = '<span class="number-value">' + metric.value + '</span>' +
        '<span class="number-label">' + metric.label + '</span>';
      grid.appendChild(card);
    });
  }

  // ── C4: Fenix Intro Shell — Build Content ──────────
  function buildFenixIntroContent(persona) {
    var config = getPersonaConfig(persona);
    if (!config) return;

    // Left column: unlocks
    var unlocksList = document.querySelector('.fenix-intro-unlocks');
    if (unlocksList && config.unlocks) {
      unlocksList.innerHTML = '';

      // Two-column layout: large avatar | text content
      var unlockLayout = document.createElement('div');
      unlockLayout.className = 'unlock-layout';

      if (config.image) {
        var avatarWrap = document.createElement('span');
        avatarWrap.className = 'unlock-avatar-wrap';
        var avatar = document.createElement('img');
        avatar.className = 'unlock-avatar';
        avatar.src = config.image;
        avatar.alt = config.character;
        avatarWrap.appendChild(avatar);
        unlockLayout.appendChild(avatarWrap);
      }

      var unlockContent = document.createElement('div');
      unlockContent.className = 'unlock-content';

      var heading = document.createElement('p');
      heading.className = 'unlock-heading';
      heading.innerHTML = 'As <span style="color:' + config.accent + '">' + config.name + '</span>, here\'s what\'s unlocked:';
      unlockContent.appendChild(heading);

      config.unlocks.forEach(function (unlock) {
        var item = document.createElement('a');
        item.className = 'unlock-item';
        item.href = unlock.link;
        item.innerHTML = '<span class="unlock-label">' + unlock.label + '</span><span class="unlock-desc">' + unlock.desc + '</span>';
        unlockContent.appendChild(item);
      });

      unlockLayout.appendChild(unlockContent);
      unlocksList.appendChild(unlockLayout);
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
    { text: "The people who are crazy enough to think they can change the world are the ones who do.", source: "Steve Jobs" },
    { text: "Success consists of going from failure to failure without loss of enthusiasm.", source: "Winston Churchill" },
    { text: "It is your attitude, not your aptitude, that determines your altitude.", source: "Zig Ziglar" },
    { text: "You must be the change you wish to see in the world.", source: "Mahatma Gandhi" },
    { text: "The secret of change is to focus all of your energy not on fighting the old, but on building the new.", source: "Socrates" },
    { text: "All things are difficult before they are easy.", source: "Thomas Fuller" },
    { text: "In order to design a future of positive change, we must first become experts at changing our minds.", source: "Jacque Fresco" },
    { text: "If at first the idea is not absurd, then there will be no hope for it.", source: "Albert Einstein" },
    { text: "The true sign of intelligence is not knowledge but imagination.", source: "Albert Einstein" },
    { text: "The best way to predict the future is to create it.", source: "Alan Kay" },
    { text: "Logic will get you from A to B. Imagination will take you everywhere.", source: "Albert Einstein" },
    { text: "What is now proved was once only imagined.", source: "William Blake" },
    { text: "I've failed over and over and over again in my life. And that is why I succeed.", source: "Michael Jordan" },
    { text: "The chief enemy of creativity is good sense.", source: "Pablo Picasso" },
    { text: "Creativity is allowing yourself to make mistakes. Art is knowing which ones to keep.", source: "Scott Adams" },
    { text: "Innovation is not born from the dream, innovation is born from the struggle.", source: "Simon Sinek" },
    { text: "It always seems impossible until it's done.", source: "Nelson Mandela" },
    { text: "Leadership is about making others better as a result of your presence and making sure that impact lasts in your absence.", source: "Sheryl Sandberg" },
    { text: "If you can dream it, you can do it.", source: "Walt Disney" },
    { text: "Success is not final, failure is not fatal: It is the courage to continue that counts.", source: "Winston Churchill" },
    { text: "Rock bottom became the solid foundation on which I rebuilt my life.", source: "J.K. Rowling" },
    { text: "The reward for conformity is that everyone likes you but yourself.", source: "Rita Mae Brown" },
    { text: "And those who were seen dancing were thought to be insane by those who could not hear the music.", source: "Friedrich Nietzsche" },
    { text: "To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment.", source: "Ralph Waldo Emerson" },
    { text: "Those who say it can't be done are usually interrupted by others doing it.", source: "James Baldwin" },
    { text: "Culture eats strategy for breakfast.", source: "Peter Drucker" },
    { text: "Vulnerability is the birthplace of innovation, creativity, and change.", source: "Brené Brown" }
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
