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

    // Add Admin/Uzman panel links to the avatar menu for admins/experts, so
    // they are reachable on mobile (the desktop sidebar is hidden there).
    (async () => {
      const menu = document.getElementById('avatar-menu');
      if (!menu || document.getElementById('avatar-admin-link') || document.getElementById('avatar-expert-link')) return;
      const style = 'display:flex;align-items:center;gap:9px;padding:9px 12px;border-radius:8px;font-size:13px;font-weight:500;color:#1A1208;text-decoration:none;';
      const mk = (href, label, id) => { const a = document.createElement('a'); a.id = id; a.href = href; a.style.cssText = style; a.textContent = label; return a; };
      const anchor = menu.querySelector('a'); // the "Profilim" link
      try {
        const { data: prof } = await sb.from('profiles').select('is_admin').eq('id', session.user.id).maybeSingle();
        if (prof && prof.is_admin) {
          const a = mk('admin.html', '\u2699\uFE0F Admin Paneli', 'avatar-admin-link');
          anchor ? anchor.after(a) : menu.prepend(a);
        }
      } catch (e) {}
      try {
        const { data: exp } = await sb.from('experts').select('id').eq('profile_id', session.user.id).eq('is_active', true);
        if (exp && exp.length) {
          const a = mk('expert-panel.html', '\uD83D\uDEE1\uFE0F Uzman Paneli', 'avatar-expert-link');
          anchor ? anchor.after(a) : menu.prepend(a);
        }
      } catch (e) {}
    })();

    // Refresh badge + bell + conversation list together (whichever exist here).
    const refreshAll = () => {
      refresh();
      if (typeof window.loadNotifications === 'function') { try { window.loadNotifications(); } catch (e) {} }
      if (typeof window.loadConversations === 'function') { try { window.loadConversations(); } catch (e) {} }
    };

    // Reliable path: refresh whenever the user returns to the screen — tab/app
    // focus, or bfcache restore. Covers the common case (you come back to
    // Mesajlar and see the latest) without depending on the realtime socket.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refreshAll();
    });
    window.addEventListener('focus', refreshAll);
    window.addEventListener('pageshow', refreshAll);

    // Live bonus: realtime push when a notification is inserted for me.
    try {
      sb.realtime.setAuth(session.access_token); // so RLS delivers my rows
      sb.channel('notif-live-' + session.user.id)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` },
          refreshAll)
        .subscribe();
    } catch (e) { console.warn('notif realtime subscribe failed:', e); }
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
        position: fixed; right: 0; top: 58%; transform: translateY(-50%);
        z-index: 9998; writing-mode: vertical-rl;
        background: var(--navy, #1B3A8C); color: #fff; border: none;
        border-radius: 8px 0 0 8px; padding: 14px 6px; cursor: pointer;
        font-family: 'Instrument Sans', system-ui, sans-serif;
        font-size: 12px; font-weight: 600; letter-spacing: .4px; text-decoration: none;
        box-shadow: -2px 2px 8px rgba(0,0,0,.18);
      }
      #bb-feedback-btn:hover { filter: brightness(1.1); }`;
    document.head.appendChild(style);

    const a = document.createElement('a');
    a.id = 'bb-feedback-btn';
    a.href = '#';
    a.textContent = 'Geri bildirim';
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


// Navy underline accent on the nav wordmark (brand look), site-wide.
(function navLogoUnderline() {
  /* nav-logo underline */
  if (document.getElementById('bb-navlogo-style')) return;
  const st = document.createElement('style');
  st.id = 'bb-navlogo-style';
  st.textContent = 'a.nav-logo-link > span{display:inline-block;background:#003399;padding:4px 9px 5px;border-radius:5px;color:#FFCC00;}';
  document.head.appendChild(st);
})();


// Remove any leftover language switcher injected by a cached old i18n.js.
// Platform is Turkish-only, so the switcher should never appear.
(function killLangSwitcher() {
  function kill() {
    var el = document.getElementById('bb-lang-switcher'); if (el) el.remove();
    document.querySelectorAll('.bb-lang-wrap').forEach(function (n) { n.remove(); });
  }
  kill();
  var obs;
  try { obs = new MutationObserver(kill); obs.observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
  setTimeout(function () { kill(); if (obs) obs.disconnect(); }, 4000);
})();
