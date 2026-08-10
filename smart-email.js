// smart-email.js — BizdenBize Master Email Choice Handler
(function () {
  let activeEmail = '';
  let activeMailSubject = '';

  function injectModal() {
    if (document.getElementById('bb-email-modal')) return;

    const html = `
      <div id="bb-email-modal" style="position:fixed;inset:0;z-index:99999;background:rgba(26,18,8,.6);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;">
        <div style="background:#fff;border-radius:20px;max-width:420px;width:92%;padding:28px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.25);font-family:'Instrument Sans',sans-serif,system-ui;">
          <div style="font-size:36px;margin-bottom:8px;">✉️</div>
          <div style="font-family:'Playfair Display',serif,Georgia;font-size:20px;font-weight:700;color:#1A1208;margin-bottom:4px;">E-posta İletişim Seçeneği</div>
          <div style="font-size:13px;color:#4338CA;font-weight:600;margin-bottom:20px;word-break:break-all;" id="bb-ec-email">user@example.com</div>

          <button id="bb-ec-copy" style="width:100%;padding:12px;background:#4338CA;color:#fff;border:none;border-radius:9px;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:6px;font-family:inherit;">
            📋 E-posta Adresini Kopyala
          </button>
          <div style="font-size:11px;color:#6B5E4E;margin-bottom:16px;">(Gmail, Hotmail, Yahoo vb. yapıştırmak için)</div>

          <button id="bb-ec-app" style="width:100%;padding:11px;background:#F0EAE0;color:#1A1208;border:1.5px solid #D4C5A9;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:14px;font-family:inherit;">
            ✉️ E-posta Uygulamasında Aç
          </button>

          <button id="bb-ec-close" style="background:none;border:none;font-size:12px;color:#6B5E4E;cursor:pointer;text-decoration:underline;font-family:inherit;">Kapat</button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);

    document.getElementById('bb-ec-copy').onclick = function() {
      navigator.clipboard.writeText(activeEmail).then(function() {
        closeModal();
        toast(`📋 E-posta kopyalandı! (Gmail veya Webmail'e yapıştırabilirsiniz)`);
      });
    };

    document.getElementById('bb-ec-app').onclick = function() {
      const sub = activeMailSubject ? `?subject=${encodeURIComponent(activeMailSubject)}` : '';
      closeModal();
      window.location.href = `mailto:${activeEmail}${sub}`;
    };

    document.getElementById('bb-ec-close').onclick = closeModal;
    document.getElementById('bb-email-modal').onclick = function(e) {
      if (e.target === this) closeModal();
    };
  }

  function closeModal() {
    const m = document.getElementById('bb-email-modal');
    if (m) m.style.display = 'none';
    document.body.style.overflow = '';
  }

  function toast(msg) {
    let t = document.getElementById('bb-ec-toast');
    if (t) t.remove();
    t = document.createElement('div');
    t.id = 'bb-ec-toast';
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1E7B4B;color:#fff;padding:12px 24px;border-radius:10px;font-size:13px;font-weight:600;z-index:999999;box-shadow:0 4px 20px rgba(0,0,0,0.2);';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  window.promptEmailChoice = function(email, subject) {
    if (!email) return;
    activeEmail = email;
    activeMailSubject = subject || '';
    injectModal();
    document.getElementById('bb-ec-email').textContent = email;
    const m = document.getElementById('bb-email-modal');
    m.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  };

  // Intercept all clicks globally on mailto links or mail buttons
  document.addEventListener('click', function (e) {
    const target = e.target.closest('a[href^="mailto:"], [data-email]');
    if (target) {
      let email = '';
      let subject = '';
      if (target.hasAttribute('href')) {
        const href = target.getAttribute('href');
        email = href.replace('mailto:', '').split('?')[0];
        const params = new URLSearchParams(href.split('?')[1] || '');
        subject = params.get('subject') || '';
      } else if (target.hasAttribute('data-email')) {
        email = target.getAttribute('data-email');
        subject = target.getAttribute('data-subject') || '';
      }
      if (email && email.includes('@')) {
        e.preventDefault();
        e.stopPropagation();
        window.promptEmailChoice(email, subject);
      }
    }
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectModal);
  } else {
    injectModal();
  }
})();
