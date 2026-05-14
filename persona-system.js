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
      name: 'hiring teams',
      image: 'images/evaluator-merritt.webp',
      character: 'Merritt Hunter',
      title: 'Recruiter / Hiring Manager',
      tagline: 'Builder of Products People Love',
      introLine: 'Equal parts strategist, storyteller, and builder.',
      description: '15 years shipping products across mobile, AI, and fintech. I\'ve led teams at companies you\'ve heard of and startups you haven\'t — always focused on the gap between what users say they want and what actually moves the needle. This site is built the way I build products: ship fast, iterate in public, sweat the details.',
      socialLinks: ['linkedin', 'github', 'substack'],
      competencyOrder: ['Product Strategy', 'Go-to-Market Strategy', 'Delivery & Execution', 'Growth & Adoption', 'AI Integration', 'Digital Transformation'],
      heroCard: 'how-id-built-it',
      cardOrder: ['how-id-built-it', 'my-work', 'my-sandbox', 'creative-lab', 'blog-podcast', 'testimonials', 'learning', 'under-the-hood', 'now'],
      contactSubtext: "I'd love to hear about the role.",
      fenixTooltip: 'Curious about my product experience? Ask me anything.',
      unlocks: [
        { label: 'Book a conversation', desc: 'Schedule a 30-min intro call directly.', icon: 'calendar', link: '#' },
        { label: 'Download my resume', desc: 'A polished, ready-to-forward resume.', icon: 'download', link: '#' },
        { label: 'References on request', desc: 'Curated reference sheet with context.', icon: 'users', link: '#' }
      ],
      metrics: [
        { value: null, label: 'Commits shipped', live: true },
        { value: '25', label: 'Architectural components' },
        { value: '7', label: 'APIs integrated' }
      ]
    },
    seeker: {
      accent: '#777744',
      name: 'founders',
      image: 'images/seeker-phil.webp',
      character: 'Phil Thevoid',
      title: 'Founder / Needs a Product Leader',
      tagline: 'Builder Who Turns Vision into Product',
      introLine: 'Equal parts strategist, operator, and builder.',
      description: 'I\'ve been the first PM at startups and the PM who rebuilt products at scale. I know what it\'s like to have more conviction than clarity — and I know how to turn that into a roadmap that actually ships. If you\'re building something and need someone who gets it, you\'re in the right place.',
      socialLinks: ['linkedin', 'github'],
      competencyOrder: ['Go-to-Market Strategy', 'Product Strategy', 'Growth & Adoption', 'Delivery & Execution', 'AI Integration', 'Digital Transformation'],
      heroCard: 'my-work',
      cardOrder: ['my-work', 'how-id-built-it', 'my-sandbox', 'creative-lab', 'testimonials', 'blog-podcast', 'learning', 'under-the-hood', 'now'],
      contactSubtext: 'Tell me what you\'re building.',
      fenixTooltip: 'Tell me what you\'re building — I\'ll show you how I\'d think about it.',
      unlocks: [
        { label: 'Bring your problem', desc: 'Describe what you\'re building. Fenix walks through the framing.', icon: 'lightbulb', link: '#' },
        { label: 'Fractional engagement brief', desc: 'What 10 hrs/week of product leadership looks like.', icon: 'file-text', link: '#' },
        { label: 'Founder case studies', desc: 'How I\'ve helped founders ship from 0 to 1.', icon: 'briefcase', link: '#' }
      ],
      metrics: [
        { value: null, label: 'Commits, one at a time', live: true },
        { value: '7', label: 'APIs integrated' },
        { value: '3', label: 'Live prototypes shipped' }
      ]
    },
    practitioner: {
      accent: '#4DAF8B',
      name: 'product folks',
      image: 'images/practitioner-drew.webp',
      character: 'Drew Skematics',
      title: 'Product · Design · Data',
      tagline: 'Builder Who Sweats the Details',
      introLine: 'Equal parts analyst, craftsperson, and builder.',
      description: 'I think about product the way you do — tradeoffs, second-order effects, the politics of saying no. I\'ve shipped across enterprise and consumer, led rebuilds nobody wanted to touch, and documented the reasoning behind every call. This site is where I think out loud. If you\'ve ever wished your peers published their decision logs, this is that.',
      socialLinks: ['linkedin', 'substack', 'github'],
      competencyOrder: ['Product Strategy', 'AI Integration', 'Go-to-Market Strategy', 'Digital Transformation', 'Growth & Adoption', 'Delivery & Execution'],
      heroCard: 'how-id-built-it',
      cardOrder: ['how-id-built-it', 'my-work', 'my-sandbox', 'creative-lab', 'blog-podcast', 'learning', 'under-the-hood', 'testimonials', 'now'],
      contactSubtext: "I'm always up for a product debate.",
      fenixTooltip: 'Want the reasoning behind a specific teardown? Let\'s dig in.',
      unlocks: [
        { label: 'The teardown vault', desc: 'Director\'s commentary on teardowns — the dead ends and raw thinking.', icon: 'archive', link: '#' },
        { label: 'Roast my product', desc: 'Submit a URL. Get a Kiran-style quick teardown.', icon: 'zap', link: '#' },
        { label: 'Frameworks & mental models', desc: 'The actual tools I use for prioritization and analysis.', icon: 'layout', link: '#' }
      ],
      metrics: [
        { value: null, label: 'Iterations shipped', live: true },
        { value: '25', label: 'Architectural components' },
        { value: '730+', label: 'Accessibility markers' }
      ]
    },
    learner: {
      accent: '#A07ED4',
      name: 'aspiring PMs',
      image: 'images/learner-paige.webp',
      character: 'Paige Turner',
      title: 'Aspiring PM / Career Grower',
      tagline: 'Builder Who Learned by Doing',
      introLine: 'Equal parts storyteller, teacher, and builder.',
      description: 'I went from \'what even is a PM?\' to leading product teams across AI, fintech, and consumer — by being curious and building things before anyone asked me to. This site is that philosophy made real. Every component, teardown, and prototype here is something I built to learn or to teach. If you\'re on that same path, you\'re in the right place.',
      socialLinks: ['linkedin', 'substack'],
      competencyOrder: ['Growth & Adoption', 'Product Strategy', 'AI Integration', 'Go-to-Market Strategy', 'Digital Transformation', 'Delivery & Execution'],
      heroCard: 'blog-podcast',
      cardOrder: ['blog-podcast', 'how-id-built-it', 'my-sandbox', 'creative-lab', 'my-work', 'learning', 'testimonials', 'under-the-hood', 'now'],
      contactSubtext: 'Happy to chat about your PM journey.',
      fenixTooltip: 'Got a PM interview coming up? I can help you prep.',
      unlocks: [
        { label: 'Book a mentorship session', desc: 'Free 30-min call via ADPList.', icon: 'message-circle', link: '#' },
        { label: 'PM starter kit', desc: 'Curated reading list, frameworks, and interview prep.', icon: 'book-open', link: '#' },
        { label: 'Ask me about breaking in', desc: 'Fenix in mentorship mode — career transition help.', icon: 'compass', link: '#' }
      ],
      metrics: [
        { value: null, label: 'Commits to learn from', live: true },
        { value: '3', label: 'Prototypes you can try' },
        { value: '25', label: 'Components to study' }
      ]
    },
    technologist: {
      accent: '#cb5c72',
      name: 'AI builders',
      image: 'images/technologist-ray.webp',
      character: 'Ray Turing',
      title: 'CTO / AI Lead / Tech Lead',
      tagline: 'Builder Who Understands the Stack',
      introLine: 'Equal parts tinkerer, systems thinker, and builder.',
      description: 'I\'m a product leader who doesn\'t treat engineering as a black box. I\'ve led platform migrations, scoped AI integrations, and made architecture calls that held up under load. I built this entire site — not by writing every line, but by making every decision: the stack, the tradeoffs, the abstractions. That\'s the skill that matters in 2026: knowing what to build, how to build it, and when to let the tools do the typing.',
      socialLinks: ['linkedin', 'github'],
      competencyOrder: ['AI Integration', 'Product Strategy', 'Digital Transformation', 'Delivery & Execution', 'Go-to-Market Strategy', 'Growth & Adoption'],
      heroCard: 'my-sandbox',
      cardOrder: ['my-sandbox', 'under-the-hood', 'how-id-built-it', 'creative-lab', 'my-work', 'blog-podcast', 'learning', 'testimonials', 'now'],
      contactSubtext: "Let's geek out.",
      fenixTooltip: 'Want to see how I built this site with AI? Ask me.',
      unlocks: [
        { label: 'The GitHub tour', desc: 'Real repos behind this site — Fenix RAG, persona picker, and more.', icon: 'github', link: '#' },
        { label: 'Architecture decision records', desc: 'Why vanilla JS, why Supabase + pgvector, why Cloudflare.', icon: 'layers', link: '#' },
        { label: 'Pair with me', desc: '45-min technical pairing session. Pick a problem.', icon: 'code', link: '#' }
      ],
      metrics: [
        { value: null, label: 'Commits, no deploy pipeline', live: true },
        { value: '7', label: 'APIs integrated' },
        { value: '25', label: 'Architectural components' }
      ]
    },
    innercircle: {
      accent: '#cb6923',
      name: 'friends',
      image: 'images/innercircle-keshav.webp',
      character: 'Keshav Shivdasani',
      title: 'Old Friend',
      tagline: 'Builder of Weird and Wonderful Things',
      introLine: 'Equal parts overthinker, dreamer, and builder.',
      descriptionEyebrow: 'The unfiltered version ↘',
      description: 'You already know the story — the late nights, the existential spirals, the "just one more thing" that turned into this. I built a site with AI personas, a chatbot named Fenix, and a commit history that proves I haven\'t slept since February. This is the most me thing I\'ve ever made. Poke around. Roast it. You have full access.',
      socialLinks: ['linkedin'],
      competencyOrder: null, // no reorder
      heroCard: 'now',
      cardOrder: ['now', 'creative-lab', 'my-sandbox', 'under-the-hood', 'my-work', 'blog-podcast', 'testimonials', 'learning', 'how-id-built-it'],
      contactSubtext: 'You already have my number.',
      fenixTooltip: "Hey — Flame On is already turned on for you.",
      unlocks: [
        { label: 'Flame On by default', desc: 'Fenix skips the polish — raw journal entries, half-baked ideas.', icon: 'flame', link: '#' },
        { label: "What I'm actually working on", desc: 'Live-ish view of current projects. The real status.', icon: 'activity', link: '#' },
        { label: 'Direct line', desc: 'WhatsApp. No forms.', icon: 'phone', link: '#' }
      ],
      metrics: [
        { value: null, label: 'Commits since February', live: true },
        { value: '70', label: 'Hand-picked assets' },
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
  // Only show on pages with persona-specific content (i.e. the homepage)
  function buildViewingAsPill() {
    var nav = document.querySelector('.nav-container');
    if (!nav) return;

    // The pill appears on every page now (was homepage-only). On subpages,
    // clicking it triggers a redirect back to the homepage picker via
    // showPickerMode() / triggerMorphReverse() — both already handle the
    // subpage case correctly. This gives visitors a "reset my journey"
    // affordance from anywhere on the site.

    // Switch nav to space-between layout for pill + nav-right
    nav.classList.add('has-persona-pill');

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
      pill.innerHTML = avatarHtml + '<span class="pill-label">Tailored for</span> <span class="pill-persona-name">' + config.name + '</span>';
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

    // Notify same-tab listeners (e.g. nav-menu.js) — the storage event
    // only fires across tabs, so we dispatch a custom event here for
    // anyone in this page that cares about persona changes.
    try { window.dispatchEvent(new CustomEvent('persona:changed', { detail: { persona: persona, accent: accent } })); }
    catch (e) {}

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
            }, 1500);
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

    // Notify same-tab listeners (nav-menu.js etc.) that persona was cleared
    try { window.dispatchEvent(new CustomEvent('persona:changed', { detail: { persona: null, accent: null } })); }
    catch (e) {}

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
    pill.innerHTML = avatarHtml + '<span class="pill-label">Tailored for</span> <span class="pill-persona-name">' + config.name + '</span>';
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
    toast.innerHTML = 'Tailored for <span style="color:' + config.accent + '; font-weight: 600;">' + config.name + '</span>';
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

    // About description eyebrow swap (for Inner Circle)
    var descEyebrow = document.querySelector('.triptych-col-context .competency-eyebrow');
    if (descEyebrow) {
      descEyebrow.textContent = config.descriptionEyebrow || 'The elevator pitch ↘';
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

    // Card reorder (1.4) — now handled by bento-cards.js switchBentoCards()
    // Legacy applyCardReorder kept but no longer called

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

    // Triptych carousel (new layout)
    var carousel = document.getElementById('competencyCarousel');
    if (carousel) {
      // Crossfade: dim during reorder
      carousel.classList.add('reordering');
      setTimeout(function() {
        var cardMap = {};
        carousel.querySelectorAll('.competency-card').forEach(function(card) {
          var title = card.querySelector('.competency-title');
          if (title) cardMap[title.textContent.trim()] = card;
        });

        order.forEach(function(name, i) {
          if (cardMap[name]) {
            carousel.appendChild(cardMap[name]);
            // Update counter
            var counter = cardMap[name].querySelector('.competency-card-counter');
            if (counter) counter.textContent = String(i + 1).padStart(2, '0') + ' / 06';
          }
        });

        // Scroll back to first card
        carousel.scrollTo({ left: 0, behavior: 'instant' });

        // Reset dots and arrows
        var dots = document.querySelectorAll('#competencyNav .competency-dot');
        dots.forEach(function(d, i) {
          d.classList.toggle('active', i === 0);
        });
        var arrowL = document.getElementById('carouselArrowLeft');
        var arrowR = document.getElementById('carouselArrowRight');
        if (arrowL) arrowL.classList.add('hidden');
        if (arrowR) arrowR.classList.remove('hidden');

        setTimeout(function() {
          carousel.classList.remove('reordering');
        }, 50);
      }, 200);
      return;
    }

    // Legacy fallback: old grid layout
    var grid = document.querySelector('.competencies-grid');
    if (!grid) return;

    var tiles = Array.from(grid.children);
    var tileMap = {};
    tiles.forEach(function (tile) {
      var title = tile.querySelector('.competency-title');
      if (title) tileMap[title.textContent.trim()] = tile;
    });

    order.forEach(function (name) {
      if (tileMap[name]) grid.appendChild(tileMap[name]);
    });
  }

  // Bento span pattern: [4, 2, 3, 3, 2, 2, 2, 3, 3]
  // Row 1: hero(4) + sidekick(2), Row 2: pair(3+3), Row 3: trio(2+2+2), Row 4: pair(3+3)
  var BENTO_SPANS = [4, 2, 3, 3, 2, 2, 2, 3, 3];

  function applyCardReorder(order, heroCardId) {
    if (!order || !order.length) return;
    var grid = document.querySelector('.work-grid');
    if (!grid) return;

    var cards = Array.from(grid.children);
    var cardMap = {};
    cards.forEach(function (card) {
      cardMap[card.id] = card;
    });

    // Reorder cards in DOM
    order.forEach(function (id) {
      if (cardMap[id]) grid.appendChild(cardMap[id]);
    });

    // Apply bento span classes based on position
    var reordered = Array.from(grid.children);
    reordered.forEach(function (card, i) {
      // Strip existing span classes
      card.classList.remove('card-span-2', 'card-span-3', 'card-span-4', 'card-span-6');
      // Apply span based on position in bento pattern
      var span = BENTO_SPANS[i] || 2;
      card.classList.add('card-span-' + span);

      // Hero card gets horizontal layout
      if (i === 0 && span === 4) {
        card.style.flexDirection = '';  // Let CSS handle it
      }
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

  // ── Apply Context Header ───────────────────────────
  function applyContextHeader(persona) {
    var config = getPersonaConfig(persona);
    if (!config) return;
    var nameEl = document.querySelector('.fenix-context-name');
    if (nameEl) {
      // Check for connected name (persona → person): new core keys first, legacy fallback
      var connectedName = localStorage.getItem('fenix_name') || localStorage.getItem('evaluator_name') || localStorage.getItem('connect_name');
      // Validate: require at least first + last name (two distinct words)
      // Prevents partial/test names like "Test" from replacing the persona label
      if (connectedName) {
        var parts = connectedName.trim().split(/\s+/);
        if (parts.length < 2 || parts[0].toLowerCase() === parts[1].toLowerCase()) {
          connectedName = null; // fail validation → use persona name
        }
      }
      nameEl.textContent = connectedName || config.name;
    }
  }

  // ── Apply All Personalization ──────────────────────
  function applyAllPersonalization(persona) {
    if (!persona) return;
    applyAboutPersonalization(persona);
    applyAccentVariable();
    applyAccentFrame();
    applyContextHeader(persona);
    buildFenixIntroContent(persona);
    buildNumbersGrid(persona);

    // Bento monster grid: switch card assignments per persona
    if (typeof window.switchBentoCards === 'function') {
      window.switchBentoCards(persona);
    }
  }

  // ── C11: What It Took — Persona-specific metrics ──

  // Live commit count from GitHub API (fetched once, cached)
  var _liveCommitCount = null;
  var _commitFetchPromise = null;

  function fetchLiveCommitCount() {
    if (_commitFetchPromise) return _commitFetchPromise;
    _commitFetchPromise = fetch('https://api.github.com/repos/iamkiranrao/kiran-site/commits?per_page=1', {
      method: 'HEAD'
    }).then(function (res) {
      var link = res.headers.get('Link');
      if (link) {
        var match = link.match(/page=(\d+)>;\s*rel="last"/);
        if (match) {
          _liveCommitCount = parseInt(match[1], 10);
          return _liveCommitCount;
        }
      }
      return null;
    }).catch(function () {
      return null; // Fail silently, hardcoded fallback stays
    });
    return _commitFetchPromise;
  }

  // Fire the fetch immediately on script load — but only on homepage
  // (the numbers grid that consumes this lives on the homepage). Avoids
  // hitting GitHub's API from every page now that persona-system.js
  // loads site-wide for the persona pill.
  if (document.getElementById('numbers-grid') || document.getElementById('persona-picker-section')) {
    fetchLiveCommitCount();
  }

  function buildNumbersGrid(persona) {
    var grid = document.getElementById('numbers-grid');
    if (!grid) return;

    var config = getPersonaConfig(persona);
    if (!config || !config.metrics) return;

    grid.innerHTML = '';

    // Wait for commit count before rendering so live metrics show real data
    fetchLiveCommitCount().then(function (liveCount) {
      config.metrics.forEach(function (metric) {
        var card = document.createElement('div');
        card.className = 'number-card';

        var valueSpan = document.createElement('span');
        valueSpan.className = 'number-value';

        // For live metrics: show (real count - 1) initially, flip to real count on scroll
        if (metric.live && liveCount) {
          var initialVal = (liveCount - 1).toLocaleString();
          valueSpan.textContent = initialVal;
        } else if (metric.live) {
          // API failed — use a safe fallback
          valueSpan.textContent = '—';
        } else {
          valueSpan.textContent = metric.value;
        }

        var labelSpan = document.createElement('span');
        labelSpan.className = 'number-label';
        labelSpan.textContent = metric.label;

        card.appendChild(valueSpan);
        card.appendChild(labelSpan);

        // Split-flap: flips from (count - 1) → real count when section scrolls into view
        if (metric.live && liveCount) {
          initSplitFlap(card, valueSpan, liveCount);
        }

        grid.appendChild(card);
      });
    });
  }

  // Single split-flap flip — airport terminal style
  // When the card scrolls into view, flips from (count-1) to real GitHub count
  function initSplitFlap(card, valueSpan, liveCount) {
    var hasFlipped = false;
    var liveVal = liveCount.toLocaleString();

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !hasFlipped) {
          hasFlipped = true;

          setTimeout(function () {
            var flipWrap = document.createElement('span');
            flipWrap.className = 'split-flap';

            var current = document.createElement('span');
            current.className = 'flap-current';
            current.textContent = valueSpan.textContent;

            var next = document.createElement('span');
            next.className = 'flap-next';
            next.textContent = liveVal;

            flipWrap.appendChild(current);
            flipWrap.appendChild(next);

            valueSpan.textContent = '';
            valueSpan.appendChild(flipWrap);

            requestAnimationFrame(function () {
              flipWrap.classList.add('flipping');
            });

            setTimeout(function () {
              valueSpan.textContent = liveVal;
            }, 600);
          }, 2000);

          observer.disconnect();
        }
      });
    }, { threshold: 0.5 });

    observer.observe(card);
  }

  // ── C4: Fenix Intro Shell — Build Content ──────────
  function buildFenixIntroContent(persona) {
    var config = getPersonaConfig(persona);
    if (!config) return;

    // Special handling for Evaluator persona
    if (persona === 'evaluator' && typeof window.EvaluatorExperience !== 'undefined') {
      window.EvaluatorExperience.init(persona);
      return;
    }

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
          '<img src="images/fenix/1fenixavatar1.png" alt="Fenix the phoenix mascot — Kiran\'s AI assistant" class="fenix-subpage-logo">' +
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

    // Dismiss behavior
    var dismissBtn = module.querySelector('.fenix-subpage-dismiss');
    dismissBtn.addEventListener('click', function () {
      module.classList.add('dismissed');
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

  // C8: FAB removed — Fenix is accessed via the inline chat module

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
      // FAB removed
    }

    // Init morph state
    initMorph();

    // Footer quotes
    buildFooterQuotes();

    // Fenix subpage module — disabled for now, can re-enable later
    // initFenixSubpageModule();
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
