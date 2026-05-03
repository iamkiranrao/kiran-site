/* ══════════════════════════════════════════════════
   BENTO MONSTER GRID — Card Data, Persona Mapping, Image Map
   Ported from bento-monster-preview.html
   ══════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Card Content Data ── */
  var cardData = {
    teardowns: {
      eyebrow: '6 Teardowns & Counting',
      stat: "How I'd've Built It",
      desc: 'Popular app teardowns. Keep, kill, rebuild.',
      tags: ['Instagram', 'GEICO', 'Airbnb', 'Duolingo', '+2'],
      character: 'Analyst (owl)',
      overlayPos: { hero: 'pos-bl', topright: 'pos-bl', widel: 'pos-tl', wider: 'pos-br', tall: 'pos-bl', center: 'pos-bl' }
    },
    testimonials: {
      eyebrow: 'What People Say',
      stat: 'Testimonials',
      desc: 'From people I\'ve built with and for.',
      tags: ['Colleagues', 'Founders', 'Leaders'],
      character: 'Connector (quokka)',
      overlayPos: { topright: 'pos-bc', center: 'pos-bc', wider: 'pos-tr', skills: 'pos-br' }
    },
    studio: {
      eyebrow: 'Left-Brain Sandbox',
      stat: 'Studio',
      desc: 'Unrestricted play and goofery.',
      tags: ['Music', 'Photography', 'Design'],
      character: 'Artist (chinchilla)',
      overlayPos: { hero: 'pos-bl', topright: 'pos-bl', widel: 'pos-bl', wider: 'pos-bl' }
    },
    madlab: {
      eyebrow: 'Apps & Prototypes',
      stat: 'MadLab',
      desc: 'From concept to App Store.',
      tags: ['Scannibal', 'Persona Picker', 'DIA Fund'],
      character: 'Tinkerer (meerkat)',
      overlayPos: { hero: 'pos-tl', tall: 'pos-tr', widel: 'pos-br', wider: 'pos-br' }
    },
    career: {
      eyebrow: '15+ Years Building',
      stat: 'Receipts',
      desc: 'Enterprise to startup. The full arc.',
      tags: ['ADP', 'Yahoo', 'Avatour', '+3'],
      character: 'Veteran (bear)',
      overlayPos: { hero: 'pos-tr', topright: 'pos-tr', tall: 'pos-tr', center: 'pos-br', wider: 'pos-br' }
    },
    underhood: {
      eyebrow: 'Behind the Scene',
      stat: 'Under the Hood',
      desc: 'How this site was actually built.',
      tags: ['Architecture', 'AI-Assisted'],
      character: 'Engineer (bulldog)',
      overlayPos: { center: 'pos-bl', widel: 'pos-tl', wider: 'pos-tl', blog: 'pos-bl' }
    },
    now: {
      eyebrow: 'Right Now',
      stat: '/Now',
      desc: 'What I\'m focused on this month.',
      tags: ['March \'26'],
      character: 'Explorer (fox)',
      overlayPos: { now: 'pos-tr' }
    },
    skills: {
      eyebrow: 'Range & Evidence',
      stat: 'The Stack',
      desc: 'Mastered. Mapped. Proven.',
      tags: ['Product', 'AI', 'Cloud'],
      character: 'Cartographer (octopus)',
      overlayPos: { skills: 'pos-bc', topright: 'pos-br' }
    },
    blog: {
      eyebrow: 'Written Word',
      stat: 'Blog',
      desc: 'Product meets prose.',
      tags: ['Product', 'Design', 'Engineering'],
      character: 'Storyteller (orangutan)',
      overlayPos: { hero: 'pos-tr', blog: 'pos-br' }
    },
  };

  /* ── Persona → Slot → Card Mapping ── */
  var personas = {
    default:      { hero: 'teardowns', topright: 'testimonials', widel: 'studio',    wider: 'madlab',        tall: 'career',     center: 'underhood',    skills: 'skills',      blog: 'blog',      now: 'now' },
    evaluator:    { hero: 'career',    topright: 'testimonials', widel: 'studio',    wider: 'madlab',        tall: 'teardowns',  center: 'underhood',    skills: 'skills',      blog: 'blog',      now: 'now' },
    seeker:       { hero: 'career',    topright: 'teardowns',    widel: 'studio',    wider: 'underhood',     tall: 'madlab',     center: 'testimonials', skills: 'skills',      blog: 'blog',      now: 'now' },
    practitioner: { hero: 'teardowns', topright: 'career',       widel: 'studio',    wider: 'testimonials',  tall: 'madlab',     center: 'underhood',    skills: 'skills',      blog: 'blog',      now: 'now' },
    learner:      { hero: 'blog',      topright: 'skills',     widel: 'studio',    wider: 'madlab',        tall: 'teardowns',  center: 'career',       skills: 'testimonials',  blog: 'underhood', now: 'now' },
    technologist: { hero: 'madlab',    topright: 'studio',       widel: 'underhood', wider: 'career',        tall: 'teardowns',  center: 'testimonials', skills: 'skills',      blog: 'blog',      now: 'now' },
    innercircle:  { hero: 'studio',    topright: 'career',       widel: 'teardowns', wider: 'testimonials',  tall: 'madlab',     center: 'underhood',    skills: 'skills',      blog: 'blog',      now: 'now' }
  };

  /* ── Slot Ratios (for missing-image labels) ── */
  var slotRatios = {
    hero: '2:1', topright: '1:1', widel: '3:1', wider: '3:1',
    tall: '3:2', center: '1:1', skills: '1:2', blog: '2:1', now: '4:1'
  };

  /* ── Image Map: card → slot → filename ── */
  var imageMap = {
    teardowns: {
      hero: 'images/analyst-hero-2-1.png',
      topright: 'images/analyst-topright-1_1.png',
      widel: 'images/analyst-widel-3_1.png',
      wider: null,
      tall: 'images/analyst-tall-3_2.png',
      center: null
    },
    career: {
      hero: 'images/veteran-hero-2-1.png',
      topright: 'images/veteran-topright-1_1.png',
      tall: 'images/veteran-hero-2-1.png',
      center: 'images/veteran-center-1_1.png',
      wider: 'images/veteran-wider-3_1.png'
    },
    madlab: {
      hero: 'images/tinkerer-hero-2_1.png',
      tall: 'images/tinkerer-tall-3_2.png',
      widel: null,
      wider: 'images/tinkerer-hero-2-1-flipped.png'
    },
    studio: {
      hero: 'images/artist-hero-2_1.png',
      topright: 'images/artist-topright-1_1.png',
      widel: 'images/studiocardwide3_1.png',
      wider: null
    },
    testimonials: {
      topright: 'images/connector-square-1_1_2.png',
      center: 'images/connector-square-1_1_2.png',
      wider: 'images/connector-wider-3_1.png',
      skills: 'images/connector-square-1_1_2.png'
    },
    underhood: {
      center: 'images/engineer2.png',
      widel: 'images/engineer-wider-3_1.png',
      wider: 'images/engineer-wider-3_1.png',
      blog: 'images/engineer-blog-2_1.png'
    },
    now: {
      now: 'images/explorer2.png'
    },
    skills: {
      skills: 'images/octupus_skills1.png',
      topright: 'images/octopus_skills2.png'
    },
    blog: {
      hero: 'images/blogging-monster2.png',
      blog: 'images/blogging-monster2.png'
    }
  };

  /* ── Gradient Fallbacks (when no image exists) ── */
  var gradientFallbacks = {
    teardowns:    'linear-gradient(135deg, #2C2825 0%, #3A3228 50%, #2C2825 100%)',
    testimonials: 'linear-gradient(120deg, #3A3428 0%, #2E2820 50%, #3D3528 100%)',
    studio:       'linear-gradient(140deg, #352E35 0%, #2A2528 50%, #382E35 100%)',
    madlab:       'linear-gradient(130deg, #2C2425 0%, #3A2828 50%, #2C2425 100%)',
    career:       'linear-gradient(125deg, #2C3035 0%, #3A3838 50%, #2C3035 100%)',
    underhood:    'linear-gradient(130deg, #2E3235 0%, #252A2C 50%, #303538 100%)',
    now:          'linear-gradient(135deg, #3A3028 0%, #2E2520 50%, #3D3025 100%)',
    skills:     'linear-gradient(125deg, #2E3328 0%, #252A22 50%, #303528 100%)',
    blog:         'linear-gradient(145deg, #35322A 0%, #2A2822 50%, #383228 100%)',
  };

  /* ── Card ID → Destination Page ── */
  var cardPageMap = {
    teardowns:    'how-id-built-it.html',
    career:       'track-record.html',
    madlab:       'madlab.html',
    studio:       'studio.html',
    blog:         'blog-podcast.html',
    skills:     'skills.html',
    now:          'now.html',
    underhood:    'under-the-hood.html',
    testimonials: 'testimonials.html'
  };

  /* ══════════════════════════════════════════════════
     BENTO PERSONA SWITCHING
     ══════════════════════════════════════════════════ */
  function switchBentoCards(persona) {
    var config = personas[persona] || personas['default'];

    Object.keys(config).forEach(function (slot) {
      var cardId = config[slot];
      var slotEl = document.querySelector('[data-slot="' + slot + '"]');
      if (!slotEl) return;

      var card = cardData[cardId];
      if (!card) return;

      var img = imageMap[cardId] && imageMap[cardId][slot];
      var bg = slotEl.querySelector('.card-bg');

      // Set card identity
      slotEl.setAttribute('data-card', cardId);

      // Set position class — remove old, add new
      slotEl.className = slotEl.className.replace(/pos-\w+/g, '').trim();
      var posMap = card.overlayPos || {};
      var pos = posMap[slot] || 'pos-bl';
      slotEl.classList.add(pos);

      // Set background
      if (img) {
        bg.style.backgroundImage = "url('" + img + "')";
        bg.style.backgroundPosition = 'center top';
        bg.style.backgroundSize = 'cover';
        bg.style.backgroundRepeat = 'no-repeat';
        bg.style.backgroundColor = '';
        bg.classList.remove('no-image');
        bg.removeAttribute('data-need');
      } else {
        bg.style.backgroundImage = 'none';
        bg.style.background = gradientFallbacks[cardId] || '';
        bg.classList.add('no-image');
        bg.setAttribute('data-need', 'need ' + (card.character || '') + ' @ ' + (slotRatios[slot] || ''));
      }

      // Set overlay content
      var glass = slotEl.querySelector('.card-glass');
      if (glass) {
        glass.querySelector('.work-eyebrow').textContent = card.eyebrow;
        glass.querySelector('.work-stat').innerHTML = card.stat;
        glass.querySelector('.work-desc').innerHTML = card.desc;

        var tagsEl = glass.querySelector('.work-tags');
        tagsEl.innerHTML = card.tags.map(function (t) {
          return '<span class="work-tag">' + t + '</span>';
        }).join('');
      }
    });
  }

  /* ══════════════════════════════════════════════════
     MOBILE IMAGE SWAPS — use dedicated mobile images
     for blog and skills cards on small screens
     ══════════════════════════════════════════════════ */
  /* Mobile image for EVERY card — used on <=1024px so cards
     always show art regardless of which persona slot they land in.
     On desktop, some card+slot combos intentionally have no image
     (gradient placeholder). On mobile single-column, every card
     needs a real image. */
  var mobileImageOverrides = {
      teardowns:    { img: 'images/analyst-hero-2-1.png',          pos: 'center 30%' },
      career:       { img: 'images/veteran-hero-2-1.png',          pos: 'center 20%' },
      madlab:       { img: 'images/tinkerer-hero-2-1-flipped.png', pos: 'center 40%' },
      studio:       { img: 'images/studiocardwide3_1.png',         pos: 'center 50%' },
      testimonials: { img: 'images/connector-square-1_1_2.png',    pos: 'center 30%' },
      underhood:    { img: 'images/engineer2.png',                  pos: 'center 60%' },
      now:          { img: 'images/explorer2.png',                  pos: '35% 75%'   },
      skills:       { img: 'images/octopus_skills3.png',          pos: 'center 50%' },
      blog:         { img: 'images/blogmobile.png',                 pos: 'center 60%' }
  };

  function applyMobileOverrides() {
      var isMobile = window.innerWidth <= 1024;
      var cards = document.querySelectorAll('#workGrid .work-card');

      cards.forEach(function(card) {
          var cardId = card.getAttribute('data-card');
          var bg = card.querySelector('.card-bg');
          if (!bg) return;

          // --- Image overrides ---
          if (isMobile && mobileImageOverrides[cardId]) {
              var override = mobileImageOverrides[cardId];
              bg.style.background = '';
              bg.style.backgroundImage = "url('" + override.img + "')";
              bg.style.backgroundPosition = override.pos;
              bg.style.backgroundSize = 'cover';
              bg.style.backgroundRepeat = 'no-repeat';
              bg.classList.remove('no-image');
              bg.removeAttribute('data-need');
          } else if (!isMobile) {
              var slot = card.getAttribute('data-slot');
              var desktopImg = imageMap[cardId] && imageMap[cardId][slot];
              if (desktopImg) {
                  bg.style.backgroundImage = "url('" + desktopImg + "')";
                  bg.style.backgroundPosition = 'center top';
                  bg.style.backgroundSize = 'cover';
                  bg.style.backgroundRepeat = 'no-repeat';
                  bg.style.backgroundColor = '';
                  bg.classList.remove('no-image');
                  bg.removeAttribute('data-need');
              } else {
                  bg.style.backgroundImage = 'none';
                  bg.style.background = gradientFallbacks[cardId] || '';
                  bg.classList.add('no-image');
                  var cardInfo = cardData[cardId];
                  bg.setAttribute('data-need', 'need ' + (cardInfo && cardInfo.character || '') + ' @ ' + (slotRatios[slot] || ''));
              }
          }

      });
  }

  /* ══════════════════════════════════════════════════
     CLICK ROUTING (data-card based)
     ══════════════════════════════════════════════════ */
  function initBentoClickRouting() {
    var workCards = document.querySelectorAll('#workGrid .work-card');
    workCards.forEach(function (card) {
      card.addEventListener('click', function () {
        var cardId = card.getAttribute('data-card');

        var page = cardPageMap[cardId];
        if (page) {
          window.location.href = page;
        } else {
          var stat = cardData[cardId] && cardData[cardId].stat;
          if (typeof showToast === 'function') {
            showToast((stat || 'Section') + ' — coming soon.');
          }
        }
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.click();
        }
      });
    });
  }

  /* ══════════════════════════════════════════════════
     INITIALIZATION
     ══════════════════════════════════════════════════ */
  function initBento() {
    var savedPersona = localStorage.getItem('persona') || 'default';
    switchBentoCards(savedPersona);
    applyMobileOverrides();
    initBentoClickRouting();

    // Re-apply mobile overrides on resize
    var resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(applyMobileOverrides, 150);
    });
  }

  // Expose globally for persona-system.js to call
  window.applyMobileOverrides = applyMobileOverrides;
  var originalSwitchBento = switchBentoCards;
  window.switchBentoCards = function(persona) {
      originalSwitchBento(persona);
      applyMobileOverrides();
  };

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBento);
  } else {
    initBento();
  }

})();
