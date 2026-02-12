// Detect browser language
function detectLanguage() {
    const savedLang = localStorage.getItem('preferredLanguage');
    if (savedLang && translations[savedLang]) {
        return savedLang;
    }

    const browserLang = navigator.language || navigator.userLanguage;
    const langCode = browserLang.split('-')[0]; // Get 'en' from 'en-US'
    
    return translations[langCode] ? langCode : 'en';
}

// Apply translations to the page
function applyTranslations(lang) {
    const t = translations[lang] || translations.en;
    document.documentElement.lang = lang;

    // Update all data-i18n elements
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (t[key]) {
            element.textContent = t[key];
        }
    });

    // Update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        if (t[key]) {
            element.placeholder = t[key];
        }
    });

    // Update titles/tooltips
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
        const key = element.getAttribute('data-i18n-title');
        if (t[key]) {
            element.title = t[key];
        }
    });

    // Update meta description
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && lang !== 'en') {
        metaDesc.content = `${t.tagline} - ${t.location}`;
    }

    // Update page title
    if (lang !== 'en') {
        document.title = `Kiran Gorapalli - ${t.tagline}`;
    }
}

// Initialize language
let currentLang = detectLanguage();

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        applyTranslations(currentLang);
    });
} else {
    applyTranslations(currentLang);
}

// Remove preload class to enable transitions after page load
window.addEventListener('load', () => {
    document.body.classList.remove('preload');
});

// Theme Toggle - Default to dark
const themeToggle = document.getElementById('themeToggle');
const html = document.documentElement;
const moonIcon = document.querySelector('.moon-icon');
const sunIcon = document.querySelector('.sun-icon');

const currentTheme = localStorage.getItem('theme') || 'dark';
html.setAttribute('data-theme', currentTheme);

// Set initial icon visibility
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
    
    // Toggle icon visibility
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

// Populate share link input
shareLinkInput.value = shareData.url;

// Open share modal
shareButton.addEventListener('click', async () => {
    // Try native Web Share API first (works great on mobile)
    if (navigator.share) {
        try {
            await navigator.share(shareData);
        } catch (err) {
            // User cancelled or error - show modal as fallback
            if (err.name !== 'AbortError') {
                shareModal.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        }
    } else {
        // Fallback to custom modal for desktop
        shareModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
});

// Close share modal
closeShareBtn.addEventListener('click', () => {
    shareModal.classList.remove('active');
    document.body.style.overflow = '';
});

// Close modal when clicking outside
shareModal.addEventListener('click', (e) => {
    if (e.target === shareModal) {
        shareModal.classList.remove('active');
        document.body.style.overflow = '';
    }
});

// Copy link to clipboard
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
        // Fallback for older browsers
        shareLinkInput.select();
        document.execCommand('copy');
        copyLinkBtn.textContent = 'Copied!';
        
        setTimeout(() => {
            copyLinkBtn.textContent = 'Copy';
        }, 2000);
    }
});

// Email share
document.getElementById('shareEmail').addEventListener('click', (e) => {
    e.preventDefault();
    const subject = encodeURIComponent(shareData.title);
    const body = encodeURIComponent(`${shareData.text}\n\n${shareData.url}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
});

// WhatsApp share
document.getElementById('shareWhatsApp').addEventListener('click', (e) => {
    e.preventDefault();
    const text = encodeURIComponent(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
});

// LinkedIn share
document.getElementById('shareLinkedIn').addEventListener('click', (e) => {
    e.preventDefault();
    const url = encodeURIComponent(shareData.url);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank');
});

// Twitter share
document.getElementById('shareTwitter').addEventListener('click', (e) => {
    e.preventDefault();
    const text = encodeURIComponent(shareData.title);
    const url = encodeURIComponent(shareData.url);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
});

// Facebook share
document.getElementById('shareFacebook').addEventListener('click', (e) => {
    e.preventDefault();
    const url = encodeURIComponent(shareData.url);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
});

// SMS share
document.getElementById('shareSMS').addEventListener('click', (e) => {
    e.preventDefault();
    const body = encodeURIComponent(`${shareData.title}\n${shareData.url}`);
    // iOS uses sms:, Android uses sms:?
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
        window.location.href = `sms:${/iPhone|iPad|iPod/i.test(navigator.userAgent) ? '&' : '?'}body=${body}`;
    } else {
        alert('SMS sharing is available on mobile devices');
    }
});

// Close modal on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && shareModal.classList.contains('active')) {
        shareModal.classList.remove('active');
        document.body.style.overflow = '';
    }
});

// Mobile Menu
const menuButton = document.getElementById('menuButton');
const closeMenu = document.getElementById('closeMenu');
const mobileMenu = document.getElementById('mobileMenu');
const mobileLinks = document.querySelectorAll('.mobile-nav-links a');

menuButton.addEventListener('click', () => {
    mobileMenu.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent scroll when menu is open
});

closeMenu.addEventListener('click', () => {
    mobileMenu.classList.remove('active');
    document.body.style.overflow = ''; // Re-enable scroll
});

mobileLinks.forEach(link => {
    link.addEventListener('click', () => {
        mobileMenu.classList.remove('active');
        document.body.style.overflow = ''; // Re-enable scroll
    });
});

// Close menu on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (mobileMenu.classList.contains('active')) {
            mobileMenu.classList.remove('active');
            document.body.style.overflow = '';
        }
        if (languageDropdown.classList.contains('active')) {
            languageDropdown.classList.remove('active');
        }
    }
});

// Language Selector
const languageSelector = document.getElementById('languageSelector');
const languageDropdown = document.getElementById('languageDropdown');
const currentLanguageDisplay = document.getElementById('currentLanguage');
const languageOptions = document.querySelectorAll('.language-option');

// Update current language display
const langCodes = {
    'en': 'EN', 'es': 'ES', 'fr': 'FR', 'de': 'DE',
    'zh': '中文', 'ja': '日本', 'pt': 'PT', 'hi': 'हिं'
};
currentLanguageDisplay.textContent = langCodes[currentLang] || 'EN';

// Update selected option
languageOptions.forEach(option => {
    if (option.getAttribute('data-lang') === currentLang) {
        option.classList.add('selected');
    } else {
        option.classList.remove('selected');
    }
});

languageSelector.addEventListener('click', (e) => {
    e.stopPropagation();
    languageDropdown.classList.toggle('active');
});

// Close dropdown when clicking outside
document.addEventListener('click', () => {
    languageDropdown.classList.remove('active');
});

languageDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
});

languageOptions.forEach(option => {
    option.addEventListener('click', () => {
        const selectedLang = option.getAttribute('data-lang');
        
        // Update selected class
        languageOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        
        // Update display
        currentLanguageDisplay.textContent = langCodes[selectedLang] || 'EN';
        
        // Save preference
        localStorage.setItem('preferredLanguage', selectedLang);
        currentLang = selectedLang;
        
        // Apply translations
        applyTranslations(selectedLang);
        
        // Close dropdown
        languageDropdown.classList.remove('active');
    });
});

// AI Assistant
document.querySelector('.ai-assistant').addEventListener('click', () => {
    alert('Fenix AI Assistant coming soon! This will be an interactive chat to help answer questions about my work and experience.');
});

// Smooth scroll with proper offset
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const offsetTop = target.offsetTop;
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    });
});

// Optimize scroll performance
let ticking = false;
window.addEventListener('scroll', () => {
    if (!ticking) {
        window.requestAnimationFrame(() => {
            // Any scroll-based animations can go here
            ticking = false;
        });
        ticking = true;
    }
});

// Handle orientation change
window.addEventListener('orientationchange', () => {
    // Close mobile menu on orientation change
    if (mobileMenu.classList.contains('active')) {
        mobileMenu.classList.remove('active');
        document.body.style.overflow = '';
    }
});

// Improve touch scrolling on iOS
if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
    document.body.style.webkitOverflowScrolling = 'touch';
}

// ==========================================
// WORK CARDS INTERACTION
// ==========================================

const workCards = document.querySelectorAll('.work-card');
workCards.forEach((card, index) => {
    card.addEventListener('click', () => {
        const cardTitles = ['Development', 'How I\'d Build It', 'Sandbox Projects', 'Creative Work'];
        const cardLinks = [
            'https://github.com/kirangorapalli',
            null, // Case studies - coming soon
            null, // Projects - coming soon
            null  // Creative work - coming soon
        ];
        
        if (cardLinks[index]) {
            window.open(cardLinks[index], '_blank');
        } else {
            alert(`${cardTitles[index]} section coming soon! This will showcase detailed project work and case studies.`);
        }
    });
    
    // Keyboard support
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

const logoContainer = document.querySelector('.logo-container');
if (logoContainer) {
    logoContainer.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
    
    // Keyboard support
    logoContainer.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }
    });
}
