/* ============================================================
   BizdenBize — Rehber (PDF) indirme formu (ortak bileşen)
   ------------------------------------------------------------
   Sayfaya şunu koy, gerisini bu dosya halleder:
     <div data-bb-handout data-slug="tasinma-maratonu"></div>
     <script src="handout-form.js" defer></script>

   Akış:
   1) Ad + e-posta → Edge Function "handout-download" kaydı tutar
      ve 10 dakika geçerli, imzalı bir indirme bağlantısı verir.
      PDF'ler özel (private) bir Storage klasöründe durur.
   2) Bülten kutucuğu ZORUNLUDUR (işaretsiz gelir, işaretlenmeden indirme
      verilmez). İşaretlenince mevcut "newsletter" fonksiyonu çağrılır;
      çift onay (Double-Opt-In) orada yürür: onay bağlantısına basılana
      kadar bülten gönderilmez. Metin, bunun karşılığı olduğunu açıkça söyler.
   ============================================================ */
(function () {
  'use strict';

  var BASE = 'https://wxjudojlwksivhzjnmim.supabase.co/functions/v1/';
  var FN_HANDOUT = BASE + 'handout-download';
  var FN_NEWS    = BASE + 'newsletter?action=subscribe';

  var CSS = [
    '.bbh{background:#fff;border:1px solid var(--sand,#D4C5A9);border-radius:16px;padding:26px 24px;margin:0;}',
    '.bbh h3{font-family:Georgia,\'Playfair Display\',serif;font-size:20px;font-weight:700;',
      'color:var(--ink,#1A1208);margin:0 0 8px;line-height:1.3;}',
    '.bbh p.bbh-lead{font-size:14.5px;line-height:1.65;color:var(--muted,#6B5E4E);margin:0 0 18px;}',
    '.bbh-field{display:block;margin:0 0 12px;}',
    '.bbh-field span{display:block;font-size:13px;font-weight:600;color:var(--ink,#1A1208);margin:0 0 5px;}',
    '.bbh-field input{width:100%;box-sizing:border-box;padding:12px 14px;font-family:inherit;font-size:15px;',
      'border:1px solid var(--sand,#D4C5A9);border-radius:10px;background:var(--cream,#FAF7F2);color:var(--ink,#1A1208);}',
    '.bbh-field input:focus{outline:none;border-color:var(--red,#D42B2B);}',
    '.bbh-hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;}',
    '.bbh-btn{display:inline-block;border:none;border-radius:10px;padding:13px 24px;font-family:inherit;font-size:15px;',
      'font-weight:600;background:var(--red,#D42B2B);color:#fff;cursor:pointer;text-decoration:none;text-align:center;}',
    '.bbh-btn:hover{background:var(--red2,#E8393A);}',
    '.bbh-btn:disabled{opacity:.55;cursor:default;}',
    '.bbh-form .bbh-btn{width:100%;margin-top:4px;}',
    '.bbh-consent{display:flex;gap:9px;align-items:flex-start;margin:6px 0 14px;',
      'font-size:12.5px;line-height:1.6;color:var(--muted,#6B5E4E);}',
    '.bbh-consent input{margin:2px 0 0;flex-shrink:0;width:16px;height:16px;}',
    '.bbh-note{font-size:12px;line-height:1.6;color:var(--muted,#6B5E4E);margin:12px 0 0;}',
    '.bbh a{color:var(--red,#D42B2B);}',
    '.bbh-btn,.bbh-btn:hover{color:#fff;}',
    '.bbh-msg{font-size:13.5px;line-height:1.6;margin-top:12px;}',
    '.bbh-msg.err{color:var(--red,#D42B2B);}',
    '.bbh-done{text-align:center;padding:8px 0;}',
    '.bbh-done .bbh-mark{font-size:34px;margin-bottom:6px;}',
    '.bbh-done .bbh-btn{margin:6px 0 14px;}'
  ].join('');

  function styles() {
    if (document.getElementById('bbh-style')) return;
    var st = document.createElement('style');
    st.id = 'bbh-style';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function markup(title) {
    return '' +
      '<div class="bbh-form">' +
      '<h3>' + (title ? 'Ücretsiz PDF: ' + title : 'Ücretsiz PDF rehberi indir') + '</h3>' +
      '<p class="bbh-lead">Adını ve e-posta adresini yaz, bültene kayıt ol ve PDF\'i hemen indir.</p>' +
      '<label class="bbh-field"><span>Adın</span>' +
        '<input type="text" id="bbh-name" autocomplete="given-name" maxlength="80"></label>' +
      '<label class="bbh-field"><span>E-posta adresin</span>' +
        '<input type="email" id="bbh-email" autocomplete="email" inputmode="email" maxlength="254"></label>' +
      '<div class="bbh-hp" aria-hidden="true"><label>Web sitesi' +
        '<input type="text" id="bbh-web" tabindex="-1" autocomplete="off"></label></div>' +
      '<label class="bbh-consent">' +
        '<input type="checkbox" id="bbh-news">' +
        '<span>PDF\'i indirmek için bültene kayıt olmak ve yeni videolardan ile rehberlerden ' +
          'e-posta ile haberdar olmak istiyorum. Bunun için bir onay e-postası alacağım; ' +
          'bağlantıya basmadan bülten gönderilmez. Bu izni istediğim zaman, her e-postanın ' +
          'altındaki bağlantıyla geri alabilirim.</span>' +
      '</label>' +
      '<button class="bbh-btn" id="bbh-send" type="button">PDF\'i indir</button>' +
      '<div class="bbh-msg" id="bbh-msg"></div>' +
      '<p class="bbh-note">Adın ve e-posta adresin bu indirme ve bülten kaydı için saklanır. ' +
        'Reklam yok, adresin kimseyle paylaşılmaz. ' +
        '<a href="legal.html" target="_blank" rel="noopener">Gizlilik</a></p>' +
      '</div>';
  }

  function attach(box) {
    if (box.dataset.bbhReady === '1') return;
    box.dataset.bbhReady = '1';
    var slug = (box.dataset.slug || '').trim();
    var title = box.dataset.title || '';
    box.className = 'bbh';
    box.innerHTML = markup(title);

    var nameI = box.querySelector('#bbh-name');
    var email = box.querySelector('#bbh-email');
    var web   = box.querySelector('#bbh-web');
    var news  = box.querySelector('#bbh-news');
    var btn   = box.querySelector('#bbh-send');
    var msg   = box.querySelector('#bbh-msg');

    function say(text, kind) { msg.className = 'bbh-msg' + (kind ? ' ' + kind : ''); msg.textContent = text; }
    function looksLikeEmail(v) { return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(v); }

    function done(url, mailed, newsFailed, mailAddr) {
      var wrap = document.createElement('div');
      wrap.className = 'bbh-done';
      var mark = document.createElement('div'); mark.className = 'bbh-mark'; mark.textContent = '📄';
      var h = document.createElement('h3'); h.textContent = 'PDF hazır';
      var a = document.createElement('a'); a.className = 'bbh-btn'; a.href = url; a.textContent = 'PDF\'i indir';
      a.setAttribute('download', ''); a.rel = 'noopener';
      var p = document.createElement('p'); p.className = 'bbh-lead';
      p.textContent = 'Bu bağlantı 10 dakika geçerli. Süre dolarsa formu yeniden doldurabilirsin.';
      wrap.appendChild(mark); wrap.appendChild(h); wrap.appendChild(a); wrap.appendChild(p);
      if (mailed) {
        var n = document.createElement('p'); n.className = 'bbh-lead';
        n.textContent = mailAddr + ' adresine bir onay bağlantısı gönderdik. Bülten kaydı, bağlantıya basınca tamamlanır. Gelmediyse spam klasörüne bak.';
        wrap.appendChild(n);
      } else if (newsFailed) {
        var f = document.createElement('p'); f.className = 'bbh-lead';
        f.textContent = 'Bülten kaydı şu an yapılamadı. İstersen daha sonra bizdenbize.com üzerinden tekrar deneyebilirsin.';
        wrap.appendChild(f);
      }
      box.innerHTML = ''; box.appendChild(wrap);
    }

    async function submit() {
      var n = (nameI.value || '').trim();
      var v = (email.value || '').trim();
      say('');
      if (n.length < 2)        { say('Adını yaz.', 'err'); nameI.focus(); return; }
      if (!looksLikeEmail(v))  { say('Geçerli bir e-posta adresi yaz.', 'err'); email.focus(); return; }
      if (!news.checked)       { say('PDF\'i indirmek için bülten kutucuğunu işaretle.', 'err'); return; }
      if (!slug)               { say('Rehber seçilmedi.', 'err'); return; }

      btn.disabled = true;
      var old = btn.textContent; btn.textContent = 'Hazırlanıyor…';
      try {
        var r = await fetch(FN_HANDOUT, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: n, email: v, slug: slug, newsletter: true, website: web.value || '' })
        });
        if (!r.ok) throw Object.assign(new Error('http ' + r.status), { status: r.status });
        var data = await r.json();
        if (!data || !data.url) throw new Error('no url');

        var mailed = false, newsFailed = false;
        try {
          var s = await fetch(FN_NEWS, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: v }) });
          if (s.ok) mailed = true; else newsFailed = true;
        } catch (e2) { newsFailed = true; }
        done(data.url, mailed, newsFailed, v);
      } catch (e) {
        console.error('handout download failed:', e);
        var t = 'Şu an hazırlanamadı — sorun bizde. Biraz sonra tekrar dener misin?';
        if (e.status === 400) t = 'Bilgilerini bir kontrol eder misin? Ad ya da e-posta kabul edilmedi.';
        if (e.status === 404) t = 'Bu rehber henüz hazır değil. Birkaç gün sonra tekrar bak.';
        if (e.status === 429) t = 'Çok fazla deneme yapıldı. Biraz sonra tekrar dene.';
        say(t, 'err');
        btn.disabled = false; btn.textContent = old;
      }
    }

    btn.addEventListener('click', submit);
    [nameI, email].forEach(function (i) {
      i.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    });
  }

  function init() {
    var boxes = document.querySelectorAll('[data-bb-handout]');
    if (!boxes.length) return;
    styles();
    boxes.forEach(attach);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
