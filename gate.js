/* ============================================
   SITE ACCESS GATE — Under Construction
   Remove this file + all <script> references
   when the site is ready for public reveal.
   ============================================ */
(function() {
  const PASS = 'workshop2026';

  // Already authenticated this session
  if (sessionStorage.getItem('site_unlocked') === 'true') return;

  // Hide everything immediately
  document.documentElement.style.visibility = 'hidden';
  document.documentElement.style.overflow = 'hidden';

  document.addEventListener('DOMContentLoaded', function() {
    // Build overlay
    const overlay = document.createElement('div');
    overlay.id = 'site-gate';
    overlay.innerHTML = `
      <div style="
        position:fixed;inset:0;z-index:999999;
        display:flex;align-items:center;justify-content:center;
        background:#0a0a0a;font-family:Inter,system-ui,sans-serif;
      ">
        <div style="text-align:center;max-width:380px;padding:2rem;">
          <h1 style="color:#f5f0eb;font-size:1.4rem;font-weight:500;margin-bottom:.5rem;">
            Under Construction
          </h1>
          <p style="color:#8a8580;font-size:.9rem;line-height:1.5;margin-bottom:1.5rem;">
            This site is being built. If you have the password, enter it below.
          </p>
          <form id="gate-form" style="display:flex;gap:.5rem;">
            <input
              id="gate-input"
              type="password"
              placeholder="Password"
              autocomplete="off"
              style="
                flex:1;padding:.6rem 1rem;
                background:#1a1410;border:1px solid #333;border-radius:6px;
                color:#f5f0eb;font-size:.9rem;outline:none;
              "
            />
            <button type="submit" style="
              padding:.6rem 1.2rem;
              background:#9b5f28;border:none;border-radius:6px;
              color:#f5f0eb;font-size:.9rem;font-weight:500;cursor:pointer;
            ">Enter</button>
          </form>
          <p id="gate-error" style="color:#cb5c72;font-size:.8rem;margin-top:.75rem;display:none;">
            Wrong password.
          </p>
        </div>
      </div>
    `;

    document.body.prepend(overlay);
    document.documentElement.style.visibility = 'visible';

    // Only the overlay is visible — body content is behind it
    const form = document.getElementById('gate-form');
    const input = document.getElementById('gate-input');
    const error = document.getElementById('gate-error');

    input.focus();

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      if (input.value === PASS) {
        sessionStorage.setItem('site_unlocked', 'true');
        overlay.remove();
        document.documentElement.style.overflow = '';
      } else {
        error.style.display = 'block';
        input.value = '';
        input.focus();
      }
    });
  });
})();
