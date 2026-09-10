/* ============================================================
   BizdenBize — ortak Keşfet menüsü
   ------------------------------------------------------------
   Menü 20 sayfaya elle kopyalanmıştı: her sayfada İKİ kez
   (masaüstü paneli + mobil çekmece), yani 40 ayrı yer. Bir
   bölüm eklemek 40 düzenleme demekti; sonuç olarak üç sayfa
   "Mesajlar" karosu olmadan kaldı ve Videothek→Görüşler
   değişikliği hiçbirine ulaşmadı.

   Artık liste yalnızca burada. Yeni bölüm eklemek = aşağıdaki
   TILES dizisine bir satır.

   Sayfaya nasıl giriyor:
     site-footer.js bu dosyayı kendisi yüklüyor (orada açıklaması
     var). Bir sayfa footer'ı kullanmıyorsa doğrudan da eklenir:
       <script src="site-kesfet.js" defer></script>

   Ne yapıyor:
   - Sayfadaki eski #kesfet-panel / #kesfet-sheet / overlay
     düğümlerini KENDİ sürümüyle değiştirir (aynı yerde, aynı
     id ile), yoksa yenisini kurar.
   - toggleKesfet / openKesfetSheet / closeKesfetSheet
     fonksiyonlarını window üstünde yeniden tanımlar; sayfadaki
     onclick="toggleKesfet(event)" kodları çalışmaya devam eder.
   - Kendi stilini getirir: sayfa CSS'ine bağlı değildir.
   - #np-kesfet düğmesi yoksa hiçbir şey yapmaz — Keşfet'i
     olmayan sayfalara menü zorlamaz.
   ============================================================ */
(function () {
  'use strict';

  var TILES = [
    ['is-guc.html',     '💼', 'İş İlanları'],
    ['business.html',   '🏢', 'İşletmeler'],
    ['uzmanlar.html',   '👨‍⚖️', 'Uzmanlar'],
    ['ogrenim.html',    '🎓', 'Öğrenim'],
    ['nachhilfe.html',  '✏️', 'Nachhilfe'],
    ['webinar.html',    '🎥', 'Webinarlar'],
    ['saglik.html',     '🏥', 'Sağlık'],
    ['emlak.html',      '🏠', 'Konut & Emlak'],
    ['ev-takasi.html',  '🔄', 'Tatil Takası'],
    ['library.html',    '📚', 'Bilgi & Belge'],
    ['blog.html',       '✍️', 'Görüşler'],
    ['events.html',     '🎉', 'Etkinlikler'],
    ['messages.html',   '💬', 'Mesajlar']
  ];

  var STYLE_ID = 'bbk-style';
  var here = (location.pathname.split('/').pop() || 'mahallem.html').toLowerCase();

  function tiles() {
    return TILES.map(function (t) {
      // Bulunduğun sayfanın karosu tıklanabilir ama işaretli:
      // aynı yere götüren bir bağlantıya basmak kafa karıştırır.
      var on = t[0].toLowerCase() === here;
      return '<a class="bbk-tile' + (on ? ' bbk-on' : '') + '" href="' + t[0] + '">' +
             '<span class="bbk-e">' + t[1] + '</span>' + t[2] + '</a>';
    }).join('');
  }

  function styles() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent =
      '#kesfet-panel{display:none;position:absolute;top:64px;left:50%;transform:translateX(-50%);' +
        'background:#fff;border:1px solid var(--sand,#D4C5A9);border-radius:14px;' +
        'box-shadow:0 12px 32px rgba(26,18,8,.14);padding:18px;width:560px;max-width:calc(100vw - 32px);z-index:250;}' +
      '#kesfet-panel.open{display:block;}' +
      '.bbk-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}' +
      '.bbk-tile{display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 8px;' +
        'border-radius:10px;text-decoration:none;color:var(--ink,#1A1208);font-size:12.5px;' +
        'font-weight:600;text-align:center;background:var(--cream,#FAF7F2);border:1px solid transparent;}' +
      '.bbk-tile:hover{background:var(--warm,#F0EAE0);}' +
      '.bbk-tile.bbk-on{border-color:var(--sand,#D4C5A9);color:var(--red,#D42B2B);}' +
      '.bbk-e{font-size:22px;line-height:1;}' +
      '#kesfet-sheet-overlay{display:none;position:fixed;inset:0;background:rgba(26,18,8,.35);z-index:350;}' +
      '#kesfet-sheet-overlay.open{display:block;}' +
      '#kesfet-sheet{position:fixed;left:0;right:0;bottom:0;background:#fff;display:none;' +
        'border-radius:18px 18px 0 0;padding:16px 14px calc(16px + env(safe-area-inset-bottom));' +
        'z-index:351;max-height:75vh;overflow-y:auto;}' +
      '#kesfet-sheet.open{display:block;}' +
      '.bbk-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}' +
      '.bbk-title{font-size:15px;font-weight:700;color:var(--ink,#1A1208);}' +
      '.bbk-x{background:none;border:none;font-size:22px;color:var(--muted,#6B5E4E);cursor:pointer;line-height:1;padding:0 4px;}' +
      // Masaüstü paneli dar ekranda hiç açılmasın: orada çekmece var.
      '@media(max-width:900px){#kesfet-panel{display:none!important;}}';
    document.head.appendChild(st);
  }

  function buildPanel() {
    var el = document.createElement('div');
    el.id = 'kesfet-panel';
    el.innerHTML = '<div class="bbk-grid">' + tiles() + '</div>';
    return el;
  }

  function buildSheet() {
    var el = document.createElement('div');
    el.id = 'kesfet-sheet';
    el.innerHTML =
      '<div class="bbk-head"><div class="bbk-title">Keşfet</div>' +
      '<button class="bbk-x" type="button" aria-label="Kapat">&times;</button></div>' +
      '<div class="bbk-grid">' + tiles() + '</div>';
    el.querySelector('.bbk-x').addEventListener('click', closeSheet);
    return el;
  }

  function buildOverlay() {
    var el = document.createElement('div');
    el.id = 'kesfet-sheet-overlay';
    el.addEventListener('click', closeSheet);
    return el;
  }

  function swap(id, node, fallbackParent) {
    var old = document.getElementById(id);
    if (old && old.parentNode) { old.parentNode.replaceChild(node, old); }
    else if (fallbackParent) { fallbackParent.appendChild(node); }
  }

  function panel()   { return document.getElementById('kesfet-panel'); }
  function sheet()   { return document.getElementById('kesfet-sheet'); }
  function overlay() { return document.getElementById('kesfet-sheet-overlay'); }

  function togglePanel(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    var p = panel();
    if (p) p.classList.toggle('open');
  }
  function openSheet()  {
    var s = sheet(), o = overlay();
    if (s) { s.classList.add('open'); s.style.display = 'block'; }
    if (o) o.classList.add('open');
  }
  function closeSheet() {
    var s = sheet(), o = overlay();
    if (s) { s.classList.remove('open'); s.style.display = 'none'; }
    if (o) o.classList.remove('open');
  }

  function init() {
    var btn = document.getElementById('np-kesfet');
    if (!btn) return;                       // Keşfet'i olmayan sayfa
    if (document.getElementById(STYLE_ID) && panel() && panel().dataset.bbk) return;

    styles();

    var nav = btn.closest('nav') || document.body;
    var p = buildPanel();
    p.dataset.bbk = '1';
    swap('kesfet-panel', p, nav);

    swap('kesfet-sheet-overlay', buildOverlay(), document.body);
    swap('kesfet-sheet', buildSheet(), document.body);

    // Sayfalardaki inline onclick'ler bu isimleri çağırıyor.
    window.toggleKesfet     = togglePanel;
    window.openKesfetSheet  = openSheet;
    window.closeKesfetSheet = closeSheet;

    // Düğmeye kendi dinleyicimizi de bağlıyoruz: bir sayfada
    // inline onclick yoksa menü yine açılsın.
    if (!btn.getAttribute('onclick')) btn.addEventListener('click', togglePanel);

    // Dışarı tıklayınca kapat.
    document.addEventListener('click', function (e) {
      var p2 = panel();
      if (p2 && p2.classList.contains('open') &&
          !p2.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
        p2.classList.remove('open');
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (panel()) panel().classList.remove('open');
        closeSheet();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
