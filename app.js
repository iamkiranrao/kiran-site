// ==========================================
// LANGUAGE / TRANSLATION SYSTEM
// Currently disabled - uncomment translations.js in index.html to re-enable
// ==========================================

// Check if translations are loaded (they won't be when disabled)
const translationsEnabled = typeof translations !== 'undefined';

function detectLanguage() {
    if (!translationsEnabled) return 'en';
    const savedLang = localStorage.getItem('preferredLanguage');
    if (savedLang && translations[savedLang]) return savedLang;
    const browserLang = navigator.language || navigator.userLanguage;
    const langCode = browserLang.split('-')[0];
    return translations[langCode] ? langCode : 'en';
}

function applyTranslations(lang) {
    if (!translationsEnabled) return;
    const t = translations[lang] || translations.en;
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.textContent = t[key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (t[key]) el.placeholder = t[key];
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (t[key]) el.title = t[key];
    });
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && lang !== 'en') metaDesc.content = `${t.tagline} - ${t.location}`;
    if (lang !== 'en') document.title = `Kiran Gorapalli - ${t.tagline}`;
}

let currentLang = detectLanguage();

if (translationsEnabled) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => applyTranslations(currentLang));
    } else {
        applyTranslations(currentLang);
    }
}

// Remove preload class to enable transitions after page load
window.addEventListener('load', () => {
    document.body.classList.remove('preload');
});


// ==========================================
// THEME TOGGLE — Default to dark
// ==========================================

const themeToggle = document.getElementById('themeToggle');
const html = document.documentElement;
const moonIcon = document.querySelector('.moon-icon');
const sunIcon = document.querySelector('.sun-icon');

const currentTheme = localStorage.getItem('theme') || 'dark';
html.setAttribute('data-theme', currentTheme);

if (currentTheme === 'dark') {
    moonIcon.style.display = 'none';
    sunIcon.style.display = 'block';
} else {
    moonIcon.style.display = 'block';
    sunIcon.style.display = 'none';
}

themeToggle.addEventListener('click', () => {
    const theme = html.getAttribute('data-theme');
    const newTheme = theme === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') {
        moonIcon.style.display = 'none';
        sunIcon.style.display = 'block';
    } else {
        moonIcon.style.display = 'block';
        sunIcon.style.display = 'none';
    }
});


// ==========================================
// SHARE FUNCTIONALITY
// ==========================================

const shareButton = document.getElementById('shareButton');
const shareModal = document.getElementById('shareModal');
const closeShareBtn = document.getElementById('closeShare');
const shareLinkInput = document.getElementById('shareLink');
const copyLinkBtn = document.getElementById('copyLinkBtn');

const shareData = {
    title: 'Kiran Gorapalli - Builder of Products People Love',
    text: 'Check out my portfolio showcasing product management, design, and innovation.',
    url: window.location.href
};

shareLinkInput.value = shareData.url;

shareButton.addEventListener('click', async () => {
    if (navigator.share) {
        try {
            await navigator.share(shareData);
        } catch (err) {
            if (err.name !== 'AbortError') {
                shareModal.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        }
    } else {
        shareModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
});

closeShareBtn.addEventListener('click', () => {
    shareModal.classList.remove('active');
    document.body.style.overflow = '';
});

shareModal.addEventListener('click', (e) => {
    if (e.target === shareModal) {
        shareModal.classList.remove('active');
        document.body.style.overflow = '';
    }
});

copyLinkBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(shareData.url);
        copyLinkBtn.textContent = 'Copied!';
        copyLinkBtn.classList.add('copied');
        setTimeout(() => {
            copyLinkBtn.textContent = 'Copy';
            copyLinkBtn.classList.remove('copied');
        }, 2000);
    } catch (err) {
        shareLinkInput.select();
        document.execCommand('copy');
        copyLinkBtn.textContent = 'Copied!';
        setTimeout(() => { copyLinkBtn.textContent = 'Copy'; }, 2000);
    }
});

// Social share handlers
document.getElementById('shareEmail').addEventListener('click', () => {
    const subject = encodeURIComponent(shareData.title);
    const body = encodeURIComponent(`${shareData.text}\n\n${shareData.url}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
});

document.getElementById('shareWhatsApp').addEventListener('click', () => {
    const text = encodeURIComponent(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
});

document.getElementById('shareLinkedIn').addEventListener('click', () => {
    const url = encodeURIComponent(shareData.url);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank');
});

document.getElementById('shareTwitter').addEventListener('click', () => {
    const text = encodeURIComponent(shareData.title);
    const url = encodeURIComponent(shareData.url);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
});

document.getElementById('shareFacebook').addEventListener('click', () => {
    const url = encodeURIComponent(shareData.url);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
});

document.getElementById('shareSMS').addEventListener('click', () => {
    const body = encodeURIComponent(`${shareData.title}\n${shareData.url}`);
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
        window.location.href = `sms:${/iPhone|iPad|iPod/i.test(navigator.userAgent) ? '&' : '?'}body=${body}`;
    } else {
        showToast('SMS sharing is available on mobile devices.');
    }
});

// Close modal on escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && shareModal.classList.contains('active')) {
        shareModal.classList.remove('active');
        document.body.style.overflow = '';
    }
});


// ==========================================
// MOBILE MENU
// ==========================================

const menuButton = document.getElementById('menuButton');
const closeMenu = document.getElementById('closeMenu');
const mobileMenu = document.getElementById('mobileMenu');
const mobileLinks = document.querySelectorAll('.mobile-nav-links a');

menuButton.addEventListener('click', () => {
    mobileMenu.classList.add('active');
    document.body.style.overflow = 'hidden';
});

closeMenu.addEventListener('click', () => {
    mobileMenu.classList.remove('active');
    document.body.style.overflow = '';
});

mobileLinks.forEach(link => {
    link.addEventListener('click', () => {
        mobileMenu.classList.remove('active');
        document.body.style.overflow = '';
    });
});

// Close menu on escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (mobileMenu.classList.contains('active')) {
            mobileMenu.classList.remove('active');
            document.body.style.overflow = '';
        }
        // Language dropdown close (when re-enabled)
        const languageDropdown = document.getElementById('languageDropdown');
        if (languageDropdown && languageDropdown.classList.contains('active')) {
            languageDropdown.classList.remove('active');
        }
    }
});


// ==========================================
// LANGUAGE SELECTOR (only active when translations are enabled)
// ==========================================

if (translationsEnabled) {
    const languageSelector = document.getElementById('languageSelector');
    const languageDropdown = document.getElementById('languageDropdown');
    const currentLanguageDisplay = document.getElementById('currentLanguage');
    const languageOptions = document.querySelectorAll('.language-option');

    const langCodes = {
        'en': 'EN', 'es': 'ES', 'fr': 'FR', 'de': 'DE',
        'zh': '中文', 'ja': '日本', 'pt': 'PT', 'hi': 'हिं'
    };

    if (currentLanguageDisplay) {
        currentLanguageDisplay.textContent = langCodes[currentLang] || 'EN';
    }

    languageOptions.forEach(option => {
        if (option.getAttribute('data-lang') === currentLang) {
            option.classList.add('selected');
        } else {
            option.classList.remove('selected');
        }
    });

    if (languageSelector) {
        languageSelector.addEventListener('click', (e) => {
            e.stopPropagation();
            languageDropdown.classList.toggle('active');
        });
    }

    document.addEventListener('click', () => {
        if (languageDropdown) languageDropdown.classList.remove('active');
    });

    if (languageDropdown) {
        languageDropdown.addEventListener('click', (e) => e.stopPropagation());
    }

    languageOptions.forEach(option => {
        option.addEventListener('click', () => {
            const selectedLang = option.getAttribute('data-lang');
            languageOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            if (currentLanguageDisplay) {
                currentLanguageDisplay.textContent = langCodes[selectedLang] || 'EN';
            }
            localStorage.setItem('preferredLanguage', selectedLang);
            currentLang = selectedLang;
            applyTranslations(selectedLang);
            languageDropdown.classList.remove('active');
        });
    });
}


// ==========================================
// TOAST NOTIFICATION
// ==========================================

let toastTimer = null;
function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('visible');
    toastTimer = setTimeout(() => {
        toast.classList.remove('visible');
    }, duration);
}


// ==========================================
// AI ASSISTANT
// ==========================================

function launchFenix() {
    showToast('Fenix is coming soon.');
}

document.querySelector('.ai-assistant').addEventListener('click', launchFenix);

const workIntroLogo = document.querySelector('.work-intro-logo');
if (workIntroLogo) {
    workIntroLogo.addEventListener('click', launchFenix);
}

// Explore pills
document.querySelectorAll('.explore-pill').forEach(pill => {
    pill.addEventListener('click', () => {
        if (pill.dataset.fenix === 'true') {
            launchFenix();
            return;
        }
        const sectionId = pill.dataset.section;
        if (sectionId) {
            const target = document.getElementById(sectionId);
            if (target) {
                const navHeight = document.querySelector('nav').offsetHeight;
                const targetPosition = target.getBoundingClientRect().top + window.scrollY - navHeight;
                window.scrollTo({ top: targetPosition, behavior: 'smooth' });
            }
        }
    });
});


// ==========================================
// SMOOTH SCROLL
// ==========================================

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const navHeight = document.querySelector('nav').offsetHeight;
            const targetPosition = target.getBoundingClientRect().top + window.scrollY - navHeight;
            window.scrollTo({ top: targetPosition, behavior: 'smooth' });
        }
    });
});


// ==========================================
// ORIENTATION CHANGE
// ==========================================

window.addEventListener('orientationchange', () => {
    if (mobileMenu.classList.contains('active')) {
        mobileMenu.classList.remove('active');
        document.body.style.overflow = '';
    }
});

if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
    document.body.style.webkitOverflowScrolling = 'touch';
}


// ==========================================
// WORK CARDS INTERACTION
// ==========================================

const workCards = document.querySelectorAll('.work-card');
const cardConfig = [
    { title: 'Career Highlights', link: 'career-highlights.html', sameTab: true },
    { title: 'How I\'d\'ve Built It', link: 'how-id-built-it.html', sameTab: true },
    { title: 'My MadLab', link: 'madlab.html', sameTab: true },
    { title: 'Creative Studio', link: 'studio.html', sameTab: true },
    { title: 'Blog & Podcast', link: 'blog-podcast.html', sameTab: true },
    { title: 'Learning & Certifications', link: 'learning.html', sameTab: true },
    { title: 'Causes', link: 'causes.html', sameTab: true },
    { title: 'Store', link: 'store.html', sameTab: true }
];

workCards.forEach((card, index) => {
    const config = cardConfig[index] || { title: 'Section', link: null };
    card.addEventListener('click', () => {
        if (config.link && config.sameTab) {
            window.location.href = config.link;
        } else if (config.link) {
            window.open(config.link, '_blank', 'noopener,noreferrer');
        } else {
            showToast(`${config.title} - coming soon.`);
        }
    });
    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            card.click();
        }
    });
});


// ==========================================
// LOGO CLICK TO SCROLL TOP
// ==========================================

// Footer logo — scroll to top
const footerLogo = document.querySelector('.footer-logo');
if (footerLogo) {
    footerLogo.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    footerLogo.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
}

// ============================================
// WORK IMAGE HOVER EFFECT
// Handled purely in CSS now (grid layout, no parallax)
// ============================================


// ============================================
// FOOTER FEEDBACK
// ============================================

let selectedRating = null;
const feedbackRatingInput = document.getElementById('feedbackRatingInput');

document.querySelectorAll('.feedback-face').forEach(face => {
    face.addEventListener('click', () => {
        document.querySelectorAll('.feedback-face').forEach(f => f.classList.remove('selected'));
        face.classList.add('selected');
        selectedRating = face.dataset.rating;
        if (feedbackRatingInput) feedbackRatingInput.value = selectedRating;
    });
});

const feedbackForm = document.getElementById('feedbackForm');
const feedbackThanks = document.getElementById('feedbackThanks');

if (feedbackForm) {
    feedbackForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const comment = feedbackForm.querySelector('.feedback-comment').value;
        if (!selectedRating && !comment.trim()) return;

        const formData = new FormData(feedbackForm);
        fetch('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(formData).toString()
        })
        .then(response => {
            if (!response.ok) throw new Error('Submit failed');
            feedbackForm.querySelector('.feedback-submit').style.display = 'none';
            feedbackForm.querySelector('.feedback-comment').style.display = 'none';
            feedbackForm.querySelector('.feedback-faces').style.opacity = '0.5';
            feedbackForm.querySelector('.feedback-faces').style.pointerEvents = 'none';
            feedbackThanks.classList.add('visible');
        })
        .catch(() => {
            showToast('Something went wrong. Please try again.');
        });
    });
}

// Testimonial Form (Netlify Forms)
const testimonialForm = document.getElementById('testimonialForm');
const testimonialThanks = document.getElementById('testimonialThanks');

if (testimonialForm) {
    testimonialForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(testimonialForm);

        fetch('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(formData).toString()
        })
        .then(response => {
            if (!response.ok) throw new Error('Submit failed');
            testimonialForm.querySelectorAll('input, textarea, button[type="submit"]').forEach(el => {
                el.style.display = 'none';
            });
            testimonialForm.querySelector('.testimonial-form-row:last-of-type').style.display = 'none';
            testimonialThanks.classList.add('visible');
        })
        .catch(() => {
            showToast('Something went wrong. Please try again.');
        });
    });
}
