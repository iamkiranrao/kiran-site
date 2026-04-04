/**
 * ============================================
 * EVALUATOR EXPERIENCE
 * Full interactive experience for the Evaluator persona
 * Replaces default Fenix intro rendering when persona === 'evaluator'
 * ============================================
 */

(function () {
  'use strict';

  // ── Configuration ──────────────────────────────────
  var API_BASE = 'https://cc.kiranrao.ai';
  var API_KEY = 'H3Ycu0N5kfv5MERh_5mYwYcMbGu6pYUv2y1KSgsMBLk';
  var ACCENT_COLOR = '#7B9ACC';

  // ── Fenix Opening Frame Text ──────────────────────
  var FENIX_OPENING = 'Quick context before we start. This isn\'t a portfolio site. It\'s a product Kiran built.\n\n' +
    'The resume comes in three versions, each tuned to a different kind of search. There\'s a Fit Score that evaluates both directions, whether Kiran fits the role and whether the role fits Kiran. And I\'m not a template chatbot. I\'ve been trained on Kiran\'s actual work, his decisions, and how he thinks.\n\n' +
    'This site isn\'t designed for a 30-second skim. But every minute you spend here will surface insights you\'d otherwise spend weeks piecing together. The more you experience, the more you understand about how Kiran thinks and works.\n\n' +
    'I\'m here to help you focus on what matters to you.';

  // ── Recruiter Questions ────────────────────────────
  var RECRUITER_QUESTIONS = [
    {
      q: 'Tell me about yourself without using your resume.',
      a: '[Answer coming soon]'
    },
    {
      q: 'What\'s an opinion you\'ve held that most people in your field disagree with?',
      a: '[Answer coming soon]'
    },
    {
      q: 'What\'s the most important question you think I should be asking that I\'m not?',
      a: '[Answer coming soon]'
    },
    {
      q: 'Tell me about a time you were wrong about something important.',
      a: '[Answer coming soon]'
    },
    {
      q: 'What would someone who\'s worked with you say is your biggest weakness?',
      a: '[Answer coming soon]'
    }
  ];

  // ── State ──────────────────────────────────────────
  var state = {
    currentPanel: null,
    connectedName: localStorage.getItem('evaluator_name'),
    connectedCompany: localStorage.getItem('evaluator_company'),
    connectedEmail: localStorage.getItem('evaluator_email'),
    fitScoreState: localStorage.getItem('evaluator_fit_state') || 'gate'
  };

  // ── Utility: Create Elements with Classes ──────────
  function createElement(tag, classNames, attrs) {
    var el = document.createElement(tag);
    if (classNames) {
      el.className = 'ev-' + classNames.split(' ').join(' ev-');
    }
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === 'text') {
          el.textContent = attrs[key];
        } else if (key === 'html') {
          el.innerHTML = attrs[key];
        } else {
          el.setAttribute(key, attrs[key]);
        }
      });
    }
    return el;
  }

  // ── Main Initialization ────────────────────────────
  function init() {
    var rightCol = document.querySelector('.fenix-intro-right');
    var leftCol = document.querySelector('.fenix-intro-left');
    if (!rightCol || !leftCol) return;

    // Clear default content
    rightCol.innerHTML = '';
    leftCol.innerHTML = '';

    // Build the right column (Fenix side)
    buildFenixColumn(rightCol);

    // Build the left column (unlock cards)
    buildUnlockCards(leftCol);

    // Restore state if already connected
    if (state.connectedName) {
      applyConnectedState();
    }
  }

  // ── Fenix Column ───────────────────────────────────
  function buildFenixColumn(container) {
    var content = createElement('div', 'fenix-column');

    // Opening frame
    var opening = createElement('div', 'fenix-opening-frame', {
      text: FENIX_OPENING
    });
    content.appendChild(opening);

    // Fenix intro section
    var intro = createElement('div', 'fenix-intro');

    // Avatar
    var avatarWrap = createElement('div', 'fenix-avatar-wrap');
    var avatar = createElement('img', 'fenix-avatar', {
      src: 'images/logo.png',
      alt: 'Fenix'
    });
    avatarWrap.appendChild(avatar);
    intro.appendChild(avatarWrap);

    // Title
    var title = createElement('h3', 'fenix-intro-title', {
      text: 'Fenix, at your service'
    });
    intro.appendChild(title);

    // Positioning line
    var positioning = createElement('p', 'fenix-positioning', {
      text: 'I know Kiran\'s work better than his resume does.'
    });
    intro.appendChild(positioning);

    // Pitch
    var pitch = createElement('p', 'fenix-pitch', {
      text: 'I can walk you through Kiran\'s experience, pull up the resume that fits your search, or if you\'re up for it, help you both figure out whether this is actually a match. The pills below are the fast paths. Or just ask me whatever\'s on your mind.'
    });
    intro.appendChild(pitch);

    content.appendChild(intro);

    // Pills
    var pillContainer = createElement('div', 'fenix-pills');

    var pills = [
      {
        text: 'Show me resume options',
        action: 'panel-a'
      },
      {
        text: 'What should I be asking?',
        action: 'panel-b'
      },
      {
        text: 'How would we evaluate each other?',
        action: 'panel-c',
        requiresConnect: true
      },
      {
        text: 'Give me a quick tour',
        action: 'tour'
      }
    ];

    pills.forEach(function (pill) {
      var btn = createElement('button', 'fenix-pill', {
        text: pill.text
      });
      if (pill.requiresConnect && !state.connectedName) {
        btn.classList.add('ev-locked');
        var badge = createElement('span', 'lock-badge', {
          text: '🔒'
        });
        btn.appendChild(badge);
      }
      btn.addEventListener('click', function () {
        handlePillClick(pill.action);
      });
      pillContainer.appendChild(btn);
    });

    content.appendChild(pillContainer);

    container.appendChild(content);
  }

  // ── Unlock Cards ───────────────────────────────────
  function buildUnlockCards(container) {
    var cardsContainer = createElement('div', 'unlock-cards');

    var cards = [
      {
        id: 'card-a',
        title: 'My resume, focused for your role',
        subtitle: 'Anonymous, open',
        icon: '📄',
        action: 'panel-a'
      },
      {
        id: 'card-b',
        title: 'The questions that actually reveal fit',
        subtitle: 'Anonymous, open',
        icon: '💬',
        action: 'panel-b'
      },
      {
        id: 'card-c',
        title: 'Does this role fit both of us?',
        subtitle: 'Connected, locked',
        icon: '📊',
        action: 'panel-c',
        locked: !state.connectedName
      }
    ];

    cards.forEach(function (card) {
      var cardEl = createElement('div', 'unlock-card', {
        'data-card': card.id
      });
      if (card.locked) {
        cardEl.classList.add('ev-locked');
      }

      var iconEl = createElement('span', 'card-icon', {
        text: card.icon
      });
      cardEl.appendChild(iconEl);

      var titleEl = createElement('h3', 'card-title', {
        text: card.title
      });
      cardEl.appendChild(titleEl);

      var subtitleEl = createElement('p', 'card-subtitle', {
        text: card.subtitle
      });
      if (card.locked) {
        subtitleEl.innerHTML = '<span class="ev-lock-icon">🔒</span> This feature is personalized — it needs to know who it\'s building the score for.';
      }
      cardEl.appendChild(subtitleEl);

      cardEl.addEventListener('click', function () {
        if (!card.locked) {
          handleCardClick(card.action);
        }
      });

      cardEl.addEventListener('keydown', function (e) {
        if (!card.locked && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleCardClick(card.action);
        }
      });

      cardEl.setAttribute('role', 'button');
      cardEl.setAttribute('tabindex', '0');

      cardsContainer.appendChild(cardEl);
    });

    container.appendChild(cardsContainer);
  }

  // ── Panel Rendering ────────────────────────────────
  function showPanel(panelType) {
    // Close existing panel
    closePanel();

    var zone = document.querySelector('.fenix-intro-zone');
    if (!zone) return;

    var panel = createElement('div', 'expanded-panel ' + panelType);

    switch (panelType) {
      case 'panel-a':
        renderResumeLensPanel(panel);
        break;
      case 'panel-b':
        renderRecruiterQuestionsPanel(panel);
        break;
      case 'panel-c':
        renderFitScorePanel(panel);
        break;
    }

    state.currentPanel = panelType;
    zone.insertAdjacentElement('afterend', panel);
    panel.classList.add('ev-open');
  }

  function closePanel() {
    var existing = document.querySelector('.ev-expanded-panel');
    if (existing) {
      existing.classList.remove('ev-open');
      setTimeout(function () {
        existing.remove();
      }, 300);
    }
    state.currentPanel = null;
  }

  // ── Panel A: Resume Lens Selector ──────────────────
  function renderResumeLensPanel(panel) {
    var heading = createElement('h3', 'panel-heading', {
      text: 'Kiran\'s resume comes in three flavors — same experience, different emphasis.'
    });
    panel.appendChild(heading);

    var lensContainer = createElement('div', 'lens-cards-container');

    var lenses = [
      {
        id: 'lens-1',
        title: 'AI Product Leader',
        desc: 'Foregrounds Fargo AI ($4.1M→$27.5M), Avatour AI agents, Fenix build. For: Anthropic, OpenAI, Google, Apple AI roles.'
      },
      {
        id: 'lens-2',
        title: 'Growth & Experimentation',
        desc: 'Foregrounds mobile scaling (18M→32M), A/B testing, adoption metrics. For: Uber, Airbnb, Meta, Intuit roles.'
      },
      {
        id: 'lens-3',
        title: 'Mobile & Consumer Product',
        desc: 'Foregrounds mobile-first at scale, consumer UX, cross-industry depth. For: Netflix, Disney, consulting, all of the above.'
      }
    ];

    lenses.forEach(function (lens) {
      var card = createElement('div', 'lens-card', {
        'data-lens': lens.id
      });

      var titleEl = createElement('h4', 'lens-title', {
        text: lens.title
      });
      card.appendChild(titleEl);

      var descEl = createElement('p', 'lens-desc', {
        text: lens.desc
      });
      card.appendChild(descEl);

      card.addEventListener('click', function () {
        document.querySelectorAll('.ev-lens-card').forEach(function (c) {
          c.classList.remove('ev-selected');
        });
        card.classList.add('ev-selected');
      });

      lensContainer.appendChild(card);
    });

    panel.appendChild(lensContainer);

    // Preview + download
    var footer = createElement('div', 'lens-footer');

    var previewNote = createElement('p', 'preview-note', {
      text: 'Preview area for selected lens goes here.'
    });
    footer.appendChild(previewNote);

    var downloadBtn = createElement('button', 'lens-download-btn', {
      text: 'Download PDF'
    });
    downloadBtn.addEventListener('click', function () {
      console.log('Download PDF clicked');
    });
    footer.appendChild(downloadBtn);

    var unconventionalLink = createElement('a', 'unconventional-link', {
      text: 'See the unconventional version',
      href: '#'
    });
    unconventionalLink.addEventListener('click', function (e) {
      e.preventDefault();
      console.log('Unconventional version clicked');
    });
    footer.appendChild(unconventionalLink);

    panel.appendChild(footer);
  }

  // ── Panel B: Recruiter Questions ───────────────────
  function renderRecruiterQuestionsPanel(panel) {
    var heading = createElement('h3', 'panel-heading', {
      text: 'These are the questions that actually tell you whether someone\'s the right fit — and my honest answers.'
    });
    panel.appendChild(heading);

    var questionsContainer = createElement('div', 'questions-container');

    RECRUITER_QUESTIONS.forEach(function (qa, idx) {
      var card = createElement('div', 'question-card');

      var titleBtn = createElement('button', 'question-title-btn', {
        text: qa.q
      });
      titleBtn.setAttribute('aria-expanded', 'false');

      var answerContent = createElement('div', 'question-answer');
      var answerText = createElement('p', 'question-answer-text', {
        text: qa.a
      });
      answerContent.appendChild(answerText);
      answerContent.style.display = 'none';

      titleBtn.addEventListener('click', function () {
        var isOpen = answerContent.style.display !== 'none';
        answerContent.style.display = isOpen ? 'none' : 'block';
        titleBtn.setAttribute('aria-expanded', !isOpen);
        titleBtn.classList.toggle('ev-open');
      });

      card.appendChild(titleBtn);
      card.appendChild(answerContent);
      questionsContainer.appendChild(card);
    });

    panel.appendChild(questionsContainer);
  }

  // ── Panel C: Fit Score Flow ────────────────────────
  function renderFitScorePanel(panel) {
    if (!state.connectedName) {
      renderConnectGate(panel);
    } else {
      renderJDInput(panel);
    }
  }

  function renderConnectGate(panel) {
    var heading = createElement('h3', 'panel-heading', {
      text: 'The Fit Score goes both ways. It evaluates how your role aligns with Kiran\'s experience, and how Kiran\'s priorities align with what you\'re offering. To make that work, I need a job description to analyze. And since this generates a personalized report, I\'ll need to know who I\'m building it for. Two ways to do that:'
    });
    panel.appendChild(heading);

    var pathsContainer = createElement('div', 'connect-paths');

    // LinkedIn path
    var linkedinPath = createElement('div', 'connect-path-card');
    var linkedinTitle = createElement('h4', 'path-title', {
      text: 'Connect with LinkedIn'
    });
    linkedinPath.appendChild(linkedinTitle);
    var linkedinSubtitle = createElement('p', 'path-subtitle', {
      text: 'Instant access, one click'
    });
    linkedinPath.appendChild(linkedinSubtitle);
    var linkedinBtn = createElement('button', 'connect-btn linkedin', {
      text: 'Connect with LinkedIn'
    });
    linkedinBtn.addEventListener('click', function () {
      console.log('LinkedIn OAuth not yet configured');
    });
    linkedinPath.appendChild(linkedinBtn);
    pathsContainer.appendChild(linkedinPath);

    // Manual path
    var manualPath = createElement('div', 'connect-path-card');
    var manualTitle = createElement('h4', 'path-title', {
      text: 'Introduce yourself'
    });
    manualPath.appendChild(manualTitle);
    var manualSubtitle = createElement('p', 'path-subtitle', {
      text: 'Name + company — that\'s it'
    });
    manualPath.appendChild(manualSubtitle);

    var form = createElement('form', 'connect-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      handleConnectSubmit(form);
    });

    var nameInput = createElement('input', 'form-input', {
      type: 'text',
      name: 'name',
      placeholder: 'Your name',
      required: 'true'
    });
    form.appendChild(nameInput);

    var companyInput = createElement('input', 'form-input', {
      type: 'text',
      name: 'company',
      placeholder: 'Company',
      required: 'true'
    });
    form.appendChild(companyInput);

    var emailInput = createElement('input', 'form-input', {
      type: 'email',
      name: 'email',
      placeholder: 'Email (optional)'
    });
    form.appendChild(emailInput);

    var submitBtn = createElement('button', 'connect-submit', {
      type: 'submit',
      text: 'Let\'s go'
    });
    form.appendChild(submitBtn);

    manualPath.appendChild(form);
    pathsContainer.appendChild(manualPath);

    panel.appendChild(pathsContainer);

    // Bailout text
    var bailout = createElement('p', 'connect-bailout', {
      html: 'The other features are yours to explore without signing in. Want to check out the <a href="#">resume options instead?</a>'
    });
    bailout.querySelector('a').addEventListener('click', function (e) {
      e.preventDefault();
      showPanel('panel-a');
    });
    panel.appendChild(bailout);
  }

  function renderJDInput(panel) {
    var greeting = createElement('p', 'jd-greeting', {
      text: 'Welcome, ' + state.connectedName + '. Got it. Now paste the job description you\'re evaluating Kiran for, and I\'ll build the Fit Score.'
    });
    panel.appendChild(greeting);

    var form = createElement('form', 'jd-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      handleJDSubmit(form);
    });

    var textarea = createElement('textarea', 'jd-input', {
      placeholder: 'Paste the full job description here...'
    });
    form.appendChild(textarea);

    var submitBtn = createElement('button', 'jd-submit', {
      text: 'Build my Fit Score'
    });
    form.appendChild(submitBtn);

    panel.appendChild(form);
  }

  // ── Connect Form Handler ────────────────────────────
  function handleConnectSubmit(form) {
    var formData = new FormData(form);
    var name = formData.get('name');
    var company = formData.get('company');
    var email = formData.get('email');

    state.connectedName = name;
    state.connectedCompany = company;
    state.connectedEmail = email;

    localStorage.setItem('evaluator_name', name);
    localStorage.setItem('evaluator_company', company);
    if (email) localStorage.setItem('evaluator_email', email);

    applyConnectedState();

    // Update locked cards
    var lockedCard = document.querySelector('[data-card="card-c"]');
    if (lockedCard) {
      lockedCard.classList.remove('ev-locked');
      var subtitle = lockedCard.querySelector('.ev-card-subtitle');
      if (subtitle) {
        subtitle.textContent = 'Connected, locked';
      }
    }

    // Update locked pills
    var fitScorePill = Array.from(document.querySelectorAll('.ev-fenix-pill')).find(function (pill) {
      return pill.textContent.includes('evaluate each other');
    });
    if (fitScorePill) {
      fitScorePill.classList.remove('ev-locked');
      var badge = fitScorePill.querySelector('.ev-lock-badge');
      if (badge) badge.remove();
    }

    // Show greeting from Fenix
    showFenixMessage('Much better. This site was built for exactly this — real people, not personas. Nice to actually meet you, ' + name + '.');

    // Transition to JD input
    setTimeout(function () {
      showPanel('panel-c');
    }, 1000);
  }

  // ── JD Submit Handler ──────────────────────────────
  function handleJDSubmit(form) {
    var textarea = form.querySelector('.ev-jd-input');
    var jdText = textarea.value.trim();

    if (!jdText) {
      alert('Please paste a job description');
      return;
    }

    // Show processing state
    showFitScoreProcessing();

    // Call backend
    callFitScoreAPI(jdText);
  }

  // ── API Communication ──────────────────────────────
  var fitScoreResults = {
    roleToKiran: [],
    kiranToRole: [],
    roleToKiranComposite: 0,
    kiranToRoleComposite: 0,
    preferredCompany: false,
    gapNotes: [],
    company: '',
    roleTitle: ''
  };

  function callFitScoreAPI(jdText) {
    var payload = {
      jd_text: jdText,
      visitor_name: state.connectedName,
      visitor_company: state.connectedCompany
    };

    fetch(API_BASE + '/api/fit-score/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify(payload)
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('API returned ' + response.status);
      }
      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';

      function readChunk() {
        return reader.read().then(function (result) {
          if (result.done) {
            // Process any remaining buffer
            if (buffer.trim()) processSSEBuffer(buffer);
            return;
          }
          buffer += decoder.decode(result.value, { stream: true });
          // Process complete SSE events from buffer
          var events = buffer.split('\n\n');
          buffer = events.pop(); // Keep incomplete event in buffer
          events.forEach(function (eventStr) {
            if (eventStr.trim()) processSSEBuffer(eventStr);
          });
          return readChunk();
        });
      }

      return readChunk();
    }).catch(function (err) {
      console.error('Fit Score API error:', err);
      showFitScoreError('Could not generate Fit Score. Please try again.');
    });
  }

  function processSSEBuffer(text) {
    var lines = text.split('\n');
    lines.forEach(function (line) {
      if (line.indexOf('data: ') === 0) {
        try {
          var data = JSON.parse(line.substring(6));
          handleSSEEvent(data);
        } catch (e) {
          // Ignore parse errors for incomplete chunks
        }
      }
    });
  }

  function handleSSEEvent(event) {
    switch (event.type) {
      case 'narration':
        addNarrationLine(event.message);
        break;

      case 'role_to_kiran':
        fitScoreResults.roleToKiran.push({
          name: event.name,
          score: event.score,
          band: event.band,
          reasoning: event.reasoning,
          gap_note: event.gap_note || null
        });
        break;

      case 'kiran_to_role':
        fitScoreResults.kiranToRole.push({
          name: event.name,
          score: event.score,
          band: event.band,
          reasoning: event.reasoning,
          gap_note: event.gap_note || null
        });
        break;

      case 'composite':
        fitScoreResults.roleToKiranComposite = event.role_to_kiran;
        fitScoreResults.kiranToRoleComposite = event.kiran_to_role;
        break;

      case 'preferred_company':
        fitScoreResults.preferredCompany = event.match;
        if (event.match) {
          addNarrationLine('Cross-referencing against Kiran\'s target companies... match found.');
        }
        break;

      case 'gap_notes':
        fitScoreResults.gapNotes = event.summary || [];
        break;

      case 'decline':
        showFitScoreDecline(event.message, []);
        break;

      case 'complete':
        if (event.decline) break;
        if (event.company) fitScoreResults.company = event.company;
        if (event.role_title) fitScoreResults.roleTitle = event.role_title;
        renderFitScoreResults();
        break;

      case 'error':
        showFitScoreError(event.message || 'An error occurred.');
        break;
    }
  }

  // ── Render Fit Score Results ────────────────────────
  function renderFitScoreResults() {
    var panel = document.querySelector('.ev-expanded-panel.ev-panel-c');
    if (!panel) return;
    panel.innerHTML = '';

    var results = createElement('div', 'ev-results');

    // Composites
    var composites = createElement('div', 'ev-composites');
    composites.appendChild(renderComposite('Role \u2192 Kiran', fitScoreResults.roleToKiranComposite, 'Can Kiran do this job?'));
    composites.appendChild(renderComposite('Kiran \u2192 Role', fitScoreResults.kiranToRoleComposite, 'Does Kiran want this job?'));
    results.appendChild(composites);

    // Preferred company badge
    if (fitScoreResults.preferredCompany) {
      var badge = createElement('div', 'ev-preferred-badge');
      badge.innerHTML = '\u2605 This is a company Kiran is actively interested in';
      results.appendChild(badge);
    }

    // Dimensions
    var dims = createElement('div', 'ev-dimensions');

    var r2kHeader = createElement('h3', 'ev-dim-section-title');
    r2kHeader.textContent = 'Role \u2192 Kiran';
    dims.appendChild(r2kHeader);

    fitScoreResults.roleToKiran.forEach(function (d) {
      dims.appendChild(renderDimension(d, '\u2192'));
    });

    var k2rHeader = createElement('h3', 'ev-dim-section-title');
    k2rHeader.textContent = 'Kiran \u2192 Role';
    dims.appendChild(k2rHeader);

    fitScoreResults.kiranToRole.forEach(function (d) {
      dims.appendChild(renderDimension(d, '\u2190'));
    });

    results.appendChild(dims);

    // Gap summary
    if (fitScoreResults.gapNotes.length > 0) {
      var gapSection = createElement('div', 'ev-gap-summary');
      var gapTitle = createElement('h3');
      gapTitle.textContent = 'What would increase these scores';
      gapSection.appendChild(gapTitle);
      var gapList = createElement('ul');
      fitScoreResults.gapNotes.forEach(function (note) {
        var li = createElement('li');
        li.textContent = note;
        gapList.appendChild(li);
      });
      gapSection.appendChild(gapList);
      results.appendChild(gapSection);
    }

    // Actions
    var actions = createElement('div', 'ev-results-actions');
    var dlBtn = createElement('button', 'ev-action-primary');
    dlBtn.textContent = 'Download as PDF';
    dlBtn.onclick = function () { console.log('PDF download — coming soon'); };
    var emailBtn = createElement('button', 'ev-action-secondary');
    emailBtn.textContent = 'Email me this';
    emailBtn.onclick = function () { console.log('Email report — coming soon'); };
    actions.appendChild(dlBtn);
    actions.appendChild(emailBtn);
    results.appendChild(actions);

    // Bridge line
    var bridge = createElement('p', 'ev-bridge-line');
    bridge.textContent = 'That\'s the picture from what I can see in the JD. If you want to explore any dimension deeper, just ask.';
    results.appendChild(bridge);

    panel.appendChild(results);
  }

  function renderComposite(label, score, subtitle) {
    var card = createElement('div', 'ev-composite');
    var dir = createElement('div', 'ev-composite-direction');
    dir.textContent = label;
    card.appendChild(dir);
    var num = createElement('div', 'ev-composite-score');
    num.textContent = score + '%';
    num.className += ' ev-composite-score--' + getBand(score).toLowerCase();
    card.appendChild(num);
    var band = createElement('div', 'ev-composite-band');
    band.textContent = getBand(score);
    card.appendChild(band);
    if (subtitle) {
      var sub = createElement('div', 'ev-composite-subtitle');
      sub.textContent = subtitle;
      sub.style.fontSize = '0.8rem';
      sub.style.color = 'var(--text-muted)';
      sub.style.marginTop = '0.5rem';
      card.appendChild(sub);
    }
    return card;
  }

  function renderDimension(d, arrow) {
    var row = createElement('div', 'ev-dimension');
    var header = createElement('div', 'ev-dimension-header');
    var name = createElement('span', 'ev-dimension-name');
    name.textContent = d.name;
    header.appendChild(name);
    var scoreWrap = createElement('span');
    var scoreNum = createElement('span', 'ev-dimension-score');
    scoreNum.textContent = d.score + '%';
    var bandLabel = createElement('span', 'ev-dimension-band');
    bandLabel.textContent = d.band;
    scoreWrap.appendChild(scoreNum);
    scoreWrap.appendChild(bandLabel);
    header.appendChild(scoreWrap);
    row.appendChild(header);

    var reasoning = createElement('p', 'ev-dimension-reasoning');
    reasoning.textContent = d.reasoning;
    row.appendChild(reasoning);

    if (d.gap_note) {
      var gap = createElement('p', 'ev-dimension-gap');
      gap.textContent = '\u2192 ' + d.gap_note;
      row.appendChild(gap);
    }
    return row;
  }

  function getBand(score) {
    if (score >= 85) return 'Strong';
    if (score >= 65) return 'Solid';
    if (score >= 45) return 'Partial';
    return 'Stretch';
  }

  function showFitScoreDecline(reason, missing) {
    var panel = document.querySelector('.ev-expanded-panel.ev-panel-c');
    if (!panel) return;
    panel.innerHTML = '';
    var container = createElement('div', 'ev-decline');
    var msg = createElement('p');
    msg.textContent = reason;
    msg.style.fontSize = '1rem';
    msg.style.marginBottom = '1rem';
    container.appendChild(msg);
    if (missing.length > 0) {
      var list = createElement('ul');
      list.style.paddingLeft = '1rem';
      missing.forEach(function (item) {
        var li = createElement('li');
        li.textContent = item;
        li.style.color = 'var(--text-muted)';
        li.style.padding = '0.25rem 0';
        list.appendChild(li);
      });
      container.appendChild(list);
    }
    var retryBtn = createElement('button', 'ev-action-primary');
    retryBtn.textContent = 'Try with a different JD';
    retryBtn.style.marginTop = '1.5rem';
    retryBtn.onclick = function () { showPanel('fitscore'); };
    container.appendChild(retryBtn);
    panel.appendChild(container);
  }

  // ── Fit Score UI States ────────────────────────────
  function showFitScoreProcessing() {
    var panel = document.querySelector('.ev-expanded-panel.ev-panel-c');
    if (panel) {
      panel.innerHTML = '';
      var container = createElement('div', 'fit-processing');

      var avatar = createElement('img', 'fenix-avatar', {
        src: 'images/logo.png',
        alt: 'Fenix'
      });
      avatar.classList.add('ev-pulse');
      container.appendChild(avatar);

      var narration = createElement('div', 'fit-narration');
      narration.setAttribute('id', 'fit-narration');
      container.appendChild(narration);

      panel.appendChild(container);
    }
  }

  function showFitScoreError(message) {
    var narration = document.getElementById('fit-narration');
    if (narration) {
      narration.innerHTML = '<p style="color: #cb5c72;">' + message + '</p>';
    }
  }

  function addNarrationLine(text) {
    var narration = document.getElementById('fit-narration');
    if (narration) {
      var line = createElement('p', 'narration-line', {
        text: text
      });
      narration.appendChild(line);
      narration.scrollTop = narration.scrollHeight;
    }
  }

  // ── Utility: Show Fenix Message ────────────────────
  function showFenixMessage(text) {
    var fenixCol = document.querySelector('.ev-fenix-column');
    if (!fenixCol) return;
    var msg = createElement('div', 'ev-transition-message');
    msg.textContent = text;
    // Insert after the opening frame
    var openingFrame = fenixCol.querySelector('.ev-opening-frame');
    if (openingFrame && openingFrame.nextSibling) {
      fenixCol.insertBefore(msg, openingFrame.nextSibling);
    } else {
      fenixCol.appendChild(msg);
    }
    // Auto-fade after 10 seconds
    setTimeout(function () {
      msg.style.opacity = '0.6';
    }, 10000);
  }

  // ── Event Handlers ─────────────────────────────────
  function handlePillClick(action) {
    if (action === 'tour') {
      window.location.href = 'under-the-hood.html';
    } else {
      showPanel(action);
    }
  }

  function handleCardClick(action) {
    showPanel(action);
  }

  // ── Connected State (after intro animation) ────────
  function applyConnectedState() {
    // Update persona label to visitor's name
    if (state.connectedName) {
      transitionNameLabel();
    }
  }

  function transitionNameLabel() {
    var labels = document.querySelectorAll('.pill-persona-name, .hero-tagline');
    labels.forEach(function (label) {
      if (label.textContent === 'The Evaluator') {
        label.classList.add('ev-name-transitioning');
        setTimeout(function () {
          label.textContent = state.connectedName;
          label.classList.remove('ev-name-transitioning');
        }, 300);
      }
    });

    var fenix = document.querySelector('.ev-fenix-column');
    if (fenix) {
      showFenixMessage('Much better. This site was built for exactly this — real people, not personas. Nice to actually meet you, ' + state.connectedName + '.');
    }
  }

  // ── Styling (inline for self-contained module) ────
  function injectStyles() {
    var style = document.createElement('style');
    style.textContent = `
      /* ── Evaluator Experience Styles ── */

      .ev-fenix-column {
        display: flex;
        flex-direction: column;
        gap: 2rem;
      }

      .ev-fenix-opening-frame {
        padding: 1.5rem;
        border-left: 3px solid var(--persona-accent);
        background: rgba(0, 0, 0, 0.2);
        border-radius: 4px;
        font-size: 0.95rem;
        line-height: 1.7;
        color: var(--text-primary);
        white-space: pre-wrap;
      }

      .ev-fenix-intro {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
      }

      .ev-fenix-avatar-wrap {
        margin-bottom: 0.5rem;
      }

      .ev-fenix-avatar {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        border: 2px solid var(--persona-accent);
      }

      .ev-fenix-intro-title {
        font-family: 'Playfair Display', serif;
        font-size: 1.8rem;
        font-weight: 600;
        color: var(--text-primary);
      }

      .ev-fenix-positioning {
        font-style: italic;
        color: var(--text-muted);
        margin: 0;
      }

      .ev-fenix-pitch {
        color: var(--text-primary);
        line-height: 1.7;
        margin: 0;
      }

      .ev-fenix-pills {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.75rem;
        width: 100%;
        margin-top: 1rem;
      }

      .ev-fenix-pill {
        padding: 0.875rem 1.25rem;
        background: transparent;
        border: 1px solid var(--border);
        border-radius: 4px;
        color: var(--text-primary);
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .ev-fenix-pill:hover:not(.ev-locked) {
        border-color: var(--persona-accent);
        color: var(--persona-accent);
        transform: translateY(-2px);
        box-shadow: 0 0 10px rgba(123, 154, 204, 0.1);
      }

      .ev-fenix-pill.ev-locked {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .ev-lock-badge {
        font-size: 0.9rem;
      }

      /* ── Unlock Cards (Left Column) ── */

      .ev-unlock-cards {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .ev-unlock-card {
        padding: 1.5rem;
        border: 1px solid var(--border);
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .ev-unlock-card:not(.ev-locked):hover {
        border-color: var(--persona-accent);
        transform: translateY(-2px);
        box-shadow: 0 0 10px rgba(123, 154, 204, 0.1);
      }

      .ev-unlock-card.ev-locked {
        opacity: 0.75;
        cursor: not-allowed;
        border-style: dashed;
      }

      .ev-card-icon {
        font-size: 1.5rem;
      }

      .ev-card-title {
        font-weight: 600;
        color: var(--text-primary);
        margin: 0;
      }

      .ev-card-subtitle {
        color: var(--text-muted);
        font-size: 0.9rem;
        margin: 0;
      }

      .ev-lock-icon {
        margin-right: 0.25rem;
      }

      /* ── Expanded Panel ── */

      .ev-expanded-panel {
        margin-top: 2rem;
        padding: 2rem;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid var(--border);
        border-radius: 4px;
        animation: slideIn 0.3s ease forwards;
        opacity: 0;
      }

      .ev-expanded-panel.ev-open {
        opacity: 1;
      }

      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .ev-panel-heading {
        font-size: 1.1rem;
        margin-bottom: 1.5rem;
        color: var(--text-primary);
      }

      /* ── Resume Lens Panel ── */

      .ev-lens-cards-container {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1rem;
        margin-bottom: 2rem;
      }

      .ev-lens-card {
        padding: 1.5rem;
        border: 1px solid var(--border);
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .ev-lens-card:hover {
        border-color: var(--persona-accent);
      }

      .ev-lens-card.ev-selected {
        border-color: var(--persona-accent);
        background: rgba(123, 154, 204, 0.05);
      }

      .ev-lens-title {
        font-weight: 600;
        margin-bottom: 0.5rem;
        color: var(--text-primary);
      }

      .ev-lens-desc {
        font-size: 0.9rem;
        color: var(--text-muted);
        line-height: 1.5;
      }

      .ev-lens-footer {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding-top: 1.5rem;
        border-top: 1px solid var(--border);
      }

      .ev-preview-note {
        color: var(--text-muted);
        font-style: italic;
        margin: 0;
      }

      .ev-lens-download-btn,
      .ev-jd-submit,
      .ev-connect-submit {
        padding: 0.75rem 1.5rem;
        background: var(--persona-accent);
        color: var(--bg-primary);
        border: none;
        border-radius: 4px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .ev-lens-download-btn:hover,
      .ev-jd-submit:hover,
      .ev-connect-submit:hover {
        opacity: 0.9;
      }

      .ev-unconventional-link {
        color: var(--persona-accent);
        text-decoration: underline;
        cursor: pointer;
      }

      /* ── Questions Panel ── */

      .ev-questions-container {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .ev-question-card {
        border: 1px solid var(--border);
        border-radius: 4px;
        overflow: hidden;
      }

      .ev-question-title-btn {
        width: 100%;
        padding: 1.25rem;
        background: transparent;
        border: none;
        text-align: left;
        color: var(--text-primary);
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .ev-question-title-btn:hover {
        background: rgba(123, 154, 204, 0.05);
      }

      .ev-question-title-btn.ev-open::after {
        content: '−';
      }

      .ev-question-title-btn:not(.ev-open)::after {
        content: '+';
      }

      .ev-question-answer {
        padding: 1.25rem;
        background: rgba(0, 0, 0, 0.2);
        border-top: 1px solid var(--border);
      }

      .ev-question-answer-text {
        color: var(--text-primary);
        line-height: 1.7;
        margin: 0;
      }

      /* ── Connect Gate ── */

      .ev-connect-paths {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1.5rem;
        margin-bottom: 2rem;
      }

      .ev-connect-path-card {
        padding: 1.5rem;
        border: 1px solid var(--border);
        border-radius: 4px;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .ev-path-title {
        font-weight: 600;
        color: var(--text-primary);
        margin: 0;
      }

      .ev-path-subtitle {
        color: var(--text-muted);
        margin: 0;
        font-size: 0.9rem;
      }

      .ev-connect-btn {
        padding: 0.75rem 1.5rem;
        background: transparent;
        border: 1px solid var(--border);
        border-radius: 4px;
        color: var(--text-primary);
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .ev-connect-btn:hover {
        border-color: var(--persona-accent);
        color: var(--persona-accent);
      }

      .ev-connect-btn.ev-linkedin {
        border-color: #0a66c2;
        color: #0a66c2;
      }

      .ev-connect-btn.ev-linkedin:hover {
        background: rgba(10, 102, 194, 0.05);
      }

      .ev-connect-form {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .ev-form-input {
        padding: 0.75rem;
        background: rgba(0, 0, 0, 0.2);
        border: 1px solid var(--border);
        border-radius: 4px;
        color: var(--text-primary);
        font-family: inherit;
        transition: all 0.2s ease;
      }

      .ev-form-input:focus {
        outline: none;
        border-color: var(--persona-accent);
        background: rgba(0, 0, 0, 0.4);
      }

      .ev-connect-bailout {
        text-align: center;
        color: var(--text-muted);
        margin-top: 1rem;
      }

      .ev-connect-bailout a {
        color: var(--persona-accent);
        text-decoration: underline;
        cursor: pointer;
      }

      /* ── JD Input ── */

      .ev-jd-greeting {
        color: var(--text-primary);
        margin-bottom: 1.5rem;
      }

      .ev-jd-form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .ev-jd-input {
        min-height: 200px;
        padding: 1rem;
        background: rgba(0, 0, 0, 0.2);
        border: 1px solid var(--border);
        border-radius: 4px;
        color: var(--text-primary);
        font-family: 'Space Mono', monospace;
        font-size: 0.9rem;
        resize: vertical;
        transition: all 0.2s ease;
      }

      .ev-jd-input:focus {
        outline: none;
        border-color: var(--persona-accent);
        background: rgba(0, 0, 0, 0.4);
      }

      /* ── Fit Score Processing ── */

      .ev-fit-processing {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2rem;
        padding: 2rem 0;
      }

      .ev-fenix-avatar.ev-pulse {
        animation: pulse 2s infinite;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      .ev-fit-narration {
        width: 100%;
        padding: 1.5rem;
        background: rgba(0, 0, 0, 0.2);
        border: 1px solid var(--border);
        border-radius: 4px;
        max-height: 300px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .ev-narration-line {
        color: var(--text-primary);
        margin: 0;
        font-size: 0.95rem;
      }

      /* ── Name Transition ── */

      .ev-name-transitioning {
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      /* ── Mobile Responsive ── */

      @media (max-width: 768px) {
        .ev-connect-paths {
          grid-template-columns: 1fr;
        }

        .ev-lens-cards-container {
          grid-template-columns: 1fr;
        }

        .ev-expanded-panel {
          padding: 1.5rem;
        }

        .ev-fenix-pills {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Initialization ─────────────────────────────────
  injectStyles();

  // Export public interface
  window.EvaluatorExperience = {
    init: function (persona) {
      if (persona === 'evaluator') {
        init();
      }
    },
    showPanel: showPanel,
    closePanel: closePanel
  };
})();
