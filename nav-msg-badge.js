// nav-msg-badge.js
// Shows an unread-message count badge on the 💬 nav icon (.nav-msg), site-wide.
// Self-contained: creates its own Supabase client and reads the logged-in
// session from shared browser storage, so it works regardless of how each
// page initialises Supabase. Injects its own CSS + badge element.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SB_URL = 'https://wxjudojlwksivhzjnmim.supabase.co';
const SB_KEY = 'sb_publishable_52tr_hEnnQ3kllZexTue0Q_ByF71303';

// 1) Inject badge styles once
(function injectStyle() {
  if (document.getElementById('nav-msg-badge-style')) return;
  const s = document.createElement('style');
  s.id = 'nav-msg-badge-style';
  s.textContent = `
    .nav-msg { position: relative; }
    .nav-msg-badge {
      position: absolute; top: 0px; right: 0px;
      min-width: 16px; height: 16px; padding: 0 4px;
      background: var(--red, #D42B2B); color: #fff;
      font-size: 10px; font-weight: 700; line-height: 16px;
      border-radius: 999px; text-align: center;
      box-shadow: 0 0 0 2px var(--cream, #FAF7F2);
      display: none; pointer-events: none;
    }`;
  document.head.appendChild(s);
})();

async function initBadge() {
  const icons = document.querySelectorAll('.nav-msg');
  if (!icons.length) return;

  const badges = [];
  icons.forEach(icon => {
    let b = icon.querySelector('.nav-msg-badge');
    if (!b) { b = document.createElement('span'); b.className = 'nav-msg-badge'; icon.appendChild(b); }
    badges.push(b);
  });

  const paint = (n) => badges.forEach(b => {
    if (n > 0) { b.textContent = n > 9 ? '9+' : String(n); b.style.display = 'block'; }
    else { b.style.display = 'none'; }
  });

  try {
    const sb = createClient(SB_URL, SB_KEY);
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return; // not logged in → no badge

    const refresh = async () => {
      try {
        const { data, error } = await sb.rpc('unread_message_count');
        if (error) { console.warn('unread badge:', error.message); return; }
        paint(Number(data) || 0);
      } catch (e) { console.warn('unread badge refresh failed:', e); }
    };

    await refresh();
    // Exposed so the real-time step (B) can refresh the badge live.
    window.__refreshMsgBadge = refresh;
  } catch (e) {
    console.warn('unread badge init failed:', e);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initBadge);
else initBadge();

// ─────────────────────────────────────────────────────────────────────────
// Feedback CTA — a floating "Geri bildirim" button, site-wide. Opens a
// pre-filled email to support@bizdenbize.com (with the page URL) and asks the
// user to attach a screenshot. Folded in here so it rides the same include
// that's already on every app page — no per-page edits needed.
// ─────────────────────────────────────────────────────────────────────────
(function injectFeedbackButton() {
  function build() {
    if (document.getElementById('bb-feedback-btn')) return;
    const style = document.createElement('style');
    style.id = 'bb-feedback-style';
    style.textContent = `
      #bb-feedback-btn {
        position: fixed; right: 16px; bottom: 84px; z-index: 9998;
        display: inline-flex; align-items: center; gap: 6px;
        background: var(--navy, #1B3A8C); color: #fff; border: none;
        border-radius: 999px; padding: 9px 14px; cursor: pointer;
        font-family: 'Instrument Sans', system-ui, sans-serif;
        font-size: 13px; font-weight: 600; text-decoration: none;
        box-shadow: 0 3px 12px rgba(0,0,0,.18);
      }
      #bb-feedback-btn:hover { filter: brightness(1.08); }
      @media (max-width: 480px) {
        #bb-feedback-btn { bottom: 90px; padding: 8px 12px; font-size: 12px; }
      }`;
    document.head.appendChild(style);

    const a = document.createElement('a');
    a.id = 'bb-feedback-btn';
    a.href = '#';
    a.textContent = '📣 Geri bildirim';
    a.addEventListener('click', function (e) {
      e.preventDefault();
      const subject = encodeURIComponent('BizdenBize Geri Bildirim');
      const body = encodeURIComponent(
        'Merhaba,\n\nGeri bildirimini aşağıya yaz (bir sorun, öneri ya da beğendiğin bir şey):\n\n\n\n' +
        '📎 Lütfen varsa EKRAN GÖRÜNTÜNÜ bu e-postaya ekle — sorunu görmemize çok yardımcı olur.\n\n' +
        '--------------------------------\n' +
        'Sayfa: ' + location.href + '\n' +
        'Tarih: ' + new Date().toLocaleString('tr-TR')
      );
      window.location.href = 'mailto:support@bizdenbize.com?subject=' + subject + '&body=' + body;
    });
    document.body.appendChild(a);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
