/* ============================================================
   BizdenBize — shared legal footer
   ------------------------------------------------------------
   Impressumspflicht: the Impressum has to be reachable from every
   page. Rather than pasting the same markup into 20+ files (which is
   how the nav avatar ended up broken on three pages), this injects it
   once from a single source.

   Add to any page with:  <script src="legal-footer.js" defer></script>

   Behaviour:
   - Does nothing if the page already links to legal.html, so it is
     safe to include everywhere, including pages that already have a
     footer of their own.
   - Inherits the page's text colour, so it works on the cream pages
     and the dark ones (admin, abibot) without per-page styling.
   - Adds clearance for the mobile bottom tab bar where one exists,
     otherwise the links sit underneath it and can't be tapped.
   ============================================================ */
(function () {
  'use strict';

  function init() {
    // Skip only if the page already has a real footer element of its own
    // (index, mahallem, ev-takasi, classifieds …). Checking for legal LINKS
    // was wrong: the legal pages link to each other in their body copy, so
    // they were skipped and ended up with no footer at all.
    if (document.querySelector('footer')) return;
    if (document.getElementById('bb-legal-footer')) return;

    var LINKS = [
      ['legal.html#impressum', 'Impressum'],
      ['legal.html#privacy', 'Gizlilik'],
      ['legal.html#terms', 'Kullanım Şartları'],
      ['legal.html#cookies', 'Çerezler']
    ];

    var wrap = document.createElement('div');
    wrap.id = 'bb-legal-footer';

    // A bottom tab bar is fixed over the page; without clearance the
    // footer renders behind it and the links can't be reached.
    var hasTabBar = !!document.querySelector(
      '.bottom-tab-bar, .bottom-nav, .tabbar, #bottom-tab-bar, #bottom-nav'
    );

    wrap.style.cssText = [
      'margin-top:36px',
      'padding:18px 24px ' + (hasTabBar ? '86px' : '28px'),
      'border-top:1px solid currentColor',
      'display:flex',
      'flex-wrap:wrap',
      'gap:8px',
      'align-items:center',
      'justify-content:center',
      'font-size:12px',
      'line-height:1.6',
      'text-align:center',
      'opacity:.55'
    ].join(';');

    var frag = '';
    LINKS.forEach(function (l, i) {
      if (i) frag += '<span style="opacity:.5;">·</span>';
      frag += '<a href="' + l[0] + '" style="color:inherit;text-decoration:none;">' + l[1] + '</a>';
    });
    frag += '<span style="width:100%;font-size:11.5px;opacity:.8;">© 2026 BizdenBize · Gurbette hayat el ele daha kolay.</span>';
    wrap.innerHTML = frag;

    // Underline on hover only — keeps it quiet until you reach for it.
    wrap.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('mouseenter', function () { a.style.textDecoration = 'underline'; });
      a.addEventListener('mouseleave', function () { a.style.textDecoration = 'none'; });
    });

    // Prefer an existing footer or main element so the links land inside
    // the page's own layout rather than after it.
    var host = document.querySelector('footer') || document.querySelector('main') || document.body;
    host.appendChild(wrap);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
