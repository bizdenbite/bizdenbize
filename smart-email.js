
// smart-email.js — BizdenBize Universal Smart Email Contact Handler
(function () {
  let activeEmail = '';
  let activeMailSubject = '';

  function injectEmailModal() {
    if (document.getElementById('email-choice-modal')) return;

    const modalHtml = `
      <div id="email-choice-modal" style="position:fixed;inset:0;z-index:9999;background:rgba(26,18,8,.55);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;">
        <div style="background:#fff;border-radius:20px;max-width:420px;width:92%;padding:28px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.2);font-family:'Instrument Sans',sans-serif,system-ui;">
          <div style="font-size:36px;margin-bottom:8px;">✉️</div>
          <div style="font-family:'Playfair Display',serif,Georgia;font-size:20px;font-weight:700;color:#1A1208;margin-bottom:4px;">E-posta İletişim Seçeneği</div>
          <div style="font-size:13px;color:#4338CA;font-weight:600;margin-bottom:20px;word-break:break-all;" id="ec-email-display">user@example.com</div>

          <button id="ec-btn-copy" style="width:100%;padding:12px;background:#4338CA;color:#fff;border:none;border-radius:9px;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:6px;font-family:inherit;">
            📋 E-posta Adresini Kopyala
          </button>
          <div style="font-size:11px;color:#6B5E4E;margin-bottom:16px;">(Gmail, Hotmail, Yahoo vb. yapıştırmak için)</div>

          <button id="ec-btn-app" style="width:100%;padding:11px;background:#F0EAE0;color:#1A1208;border:1.5px solid #D4C5A9;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:14px;font-family:inherit;">
            ✉️ E-posta Uygulamasında Aç
          </button>

          <button id="ec-btn-close" style="background:none;border:none;font-size:12px;color:#6B5E4E;cursor:pointer;text-decoration:underline;font-family:inherit;">Kapat</button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('ec-btn-copy').onclick = copyEmailChoice;
    document.getElementById('ec-btn-app').onclick = openNativeEmailApp;
    document.getElementById('ec-btn-close').onclick = closeEmailModal;
    document.getElementById('email-choice-modal').onclick = function (e) {
      if (e.target === this) closeEmailModal();
    };
  }

  window.promptEmailChoice = function (email, subject = '') {
    activeEmail = email;
    activeMailSubject = subject;
    injectEmailModal();
    document.getElementById('ec-email-display').textContent = email;
    const modal = document.getElementById('email-choice-modal');
    if (modal) {
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  };

  function closeEmailModal() {
    const modal = document.getElementById('email-choice-modal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
  }

  function copyEmailChoice() {
    navigator.clipboard.writeText(activeEmail).then(() => {
      closeEmailModal();
      showToastMsg(`📋 E-posta kopyalandı! (Gmail veya Webmail'e yapıştırabilirsiniz)`);
    });
  }

  function openNativeEmailApp() {
    const sub = activeMailSubject ? `?subject=${encodeURIComponent(activeMailSubject)}` : '';
    window.location.href = `mailto:${activeEmail}${sub}`;
    closeEmailModal();
  }

  function showToastMsg(msg) {
    if (document.getElementById('ec-toast')) document.getElementById('ec-toast').remove();
    const tip = document.createElement('div');
    tip.id = 'ec-toast';
    tip.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1E7B4B;color:#fff;padding:12px 24px;border-radius:10px;font-size:13px;font-weight:600;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.15);';
    tip.textContent = msg;
    document.body.appendChild(tip);
    setTimeout(() => tip.remove(), 3500);
  }

  // Intercept all mailto: links automatically on any page!
  document.addEventListener('click', function (e) {
    const a = e.target.closest('a[href^="mailto:"]');
    if (a) {
      e.preventDefault();
      const href = a.getAttribute('href');
      const email = href.replace('mailto:', '').split('?')[0];
      const urlParams = new URLSearchParams(href.split('?')[1] || '');
      const subject = urlParams.get('subject') || '';
      window.promptEmailChoice(email, subject);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectEmailModal);
  } else {
    injectEmailModal();
  }
})();
