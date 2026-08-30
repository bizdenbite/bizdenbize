/* ============================================================
   BizdenBize — shared site footer
   ------------------------------------------------------------
   The footer was hand-copied into 17 pages and had drifted badly:
   four different background colours, © 2025 on eleven pages and
   © 2026 on three, different link sets per page, and a slogan
   saying "Avrupa" while the platform launches Germany-first.

   One definition, injected everywhere:
     <script src="site-footer.js" defer></script>

   Behaviour:
   - Replaces an existing <footer> if the page has one, otherwise
     appends. So a page can be migrated by adding the tag alone.
   - Skips pages that opt out with <body data-no-footer> (the chat
     and admin layouts, where a page-bottom footer is never visible).
   - Self-contained inline styles: no dependency on per-page CSS.
   ============================================================ */
(function () {
  'use strict';

  var YEAR = 2026;

  var PLATFORM = [
    ['mahallem.html',    '🏘️ Mahallem'],
    ['classifieds.html', '🛍️ İlanlar'],
    ['events.html',      '🎉 Etkinlikler'],
    ['business.html',    '🏢 İşletmeler'],
    ['uzmanlar.html',    '👨‍⚖️ Uzmanlar'],
    ['is-guc.html',      '💼 İş Ver & Bul'],
    ['ev-takasi.html',   '🏡 Tatil Takası'],
    ['ogrenim.html',     '🎓 Öğrenim'],
    ['library.html',     '📚 Bilgi & Belge'],
    ['videolar.html',    '🎬 Videothek'],
    ['abibot.html',      '🤖 AbiBOT']
  ];

  var DESTEK = [
    ['hakkimizda.html', 'Hakkımızda'],
    ['sss.html',        'SSS'],
    ['iletisim.html',   'İletişim'],
    ['mailto:support@bizdenbize.com', 'support@bizdenbize.com'],
    ['abibot.html',     "🤖 AbiBOT'a Sor"]
  ];

  // All four core documents live in legal.html as tabs. The standalone
  // gizlilik/kullanim-kosullari/cerez-politikasi pages are now redirect stubs
  // kept only for old links; point straight at the anchors so members do not
  // take a redirect hop, and so the two copies cannot drift apart again.
  var YASAL = [
    ['legal.html#privacy',           'Gizlilik Politikası'],
    ['legal.html#terms',             'Kullanım Şartları'],
    ['legal.html#cookies',           'Çerez Politikası'],
    ['legal.html#impressum',         'Impressum'],
    ['legal.html#section-listings',  'İlan Kuralları'],
    ['kvkk.html',                    'KVKK / GDPR']
  ];

  var SOCIAL = [
    ['https://instagram.com/bizdenbize', 'Instagram', '📸'],
    ['https://tiktok.com/@bizdenbize',   'TikTok',    '🎵'],
    ['https://facebook.com/bizdenbize',  'Facebook',  '👤']
  ];

  function col(title, items) {
    return '<div><div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;' +
      'color:rgba(255,255,255,.4);margin-bottom:14px;">' + title + '</div>' +
      items.map(function (l) {
        return '<a href="' + l[0] + '" style="display:block;font-size:13px;color:rgba(255,255,255,.55);' +
          'text-decoration:none;margin-bottom:9px;line-height:1.4;" ' +
          'onmouseover="this.style.color=\'#fff\'" ' +
          'onmouseout="this.style.color=\'rgba(255,255,255,.55)\'">' + l[1] + '</a>';
      }).join('') + '</div>';
  }

  function build() {
    var el = document.createElement('footer');
    el.id = 'bb-site-footer';
    // display/flex/grid are forced: several pages style the <footer> ELEMENT
    // themselves (index has `footer{flex-direction:column}`), and the injected
    // footer would otherwise inherit it and lay out sideways. grid-column
    // covers pages whose <body> is itself a grid (login).
    el.style.cssText = 'display:block;flex-direction:initial;align-items:initial;text-align:left;' +
      'grid-column:1/-1;width:100%;box-sizing:border-box;' +
      'background:var(--deep, #002266);color:#fff;padding:56px 24px 28px;margin-top:56px;';

    el.innerHTML =
      '<div style="max-width:1160px;margin:0 auto;display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:40px;">' +

        '<div>' +
          '<a href="index.html" style="text-decoration:none;display:inline-block;margin-bottom:14px;">' +
            '<span style="display:inline-block;background:#003399;padding:4px 9px 5px;border-radius:5px;' +
            'font-family:Georgia,\'Times New Roman\',serif;font-weight:700;font-size:22px;line-height:1;' +
            'letter-spacing:-.3px;color:#FFCC00;white-space:nowrap;">Bizden<span style="color:#FFFFFF;">Bize</span></span>' +
          '</a>' +
          // Germany-first: the old copy said "Avrupa'daki Türk topluluğu",
          // which promised a reach the platform doesn't have yet.
          '<p style="font-size:13px;color:rgba(255,255,255,.55);line-height:1.7;max-width:320px;margin:0 0 18px;">' +
            'Almanya\'daki Türk topluluğu için güvenilir dijital mahalle. ' +
            'Komşunla bağlan, bilgine ulaş, işini bul.</p>' +
          '<div style="display:flex;gap:8px;">' +
            SOCIAL.map(function (s) {
              return '<a href="' + s[0] + '" target="_blank" rel="noopener" title="' + s[1] + '" ' +
                'style="width:34px;height:34px;border-radius:9px;background:rgba(255,255,255,.08);' +
                'display:flex;align-items:center;justify-content:center;text-decoration:none;font-size:15px;">' +
                s[2] + '</a>';
            }).join('') +
          '</div>' +
        '</div>' +

        col('Platform', PLATFORM) +
        col('Destek', DESTEK) +
        col('Yasal', YASAL) +
      '</div>' +

      '<div style="max-width:1160px;margin:36px auto 0;padding-top:20px;border-top:1px solid rgba(255,255,255,.1);' +
        'display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;font-size:12px;color:rgba(255,255,255,.35);">' +
        '<span>© ' + YEAR + ' BizdenBize · Gurbette hayat el ele daha kolay.</span>' +
        '<span>BizdenBize bu platformdaki üçüncü taraf içerik ve ilanlardan sorumlu değildir.</span>' +
      '</div>' +

      '<style>@media(max-width:820px){#bb-site-footer > div:first-child{grid-template-columns:1fr 1fr!important;gap:28px!important;}}' +
      '@media(max-width:520px){#bb-site-footer > div:first-child{grid-template-columns:1fr!important;}}</style>';

    return el;
  }

  function init() {
    if (document.body.hasAttribute('data-no-footer')) return;
    if (document.getElementById('bb-site-footer')) return;

    var existing = document.querySelector('footer');
    if (existing) {
      existing.parentNode.replaceChild(build(), existing);
    } else {
      document.body.appendChild(build());
    }

    // legal-footer.js appends a links-only strip on pages with no footer.
    // Once this runs there IS a footer, so remove the duplicate.
    var strip = document.getElementById('bb-legal-footer');
    if (strip) strip.remove();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
