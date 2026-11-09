/* ============================================================
   BizdenBize — Rehber (PDF) indirme formu (ortak bileşen)
   ------------------------------------------------------------
   Sayfaya şunu koy, gerisini bu dosya halleder:
     <div data-bb-handout data-slug="tasinma-maratonu"></div>
     <script src="handout-form.js" defer></script>

   Akış (çift onay / Double-Opt-In, Brevo üzerinden):
   1) Ad + e-posta + (zorunlu) bülten kutucuğu → "handout-download"
      fonksiyonu kaydı tutar ve Brevo'dan onay e-postası gönderir.
   2) Kişi e-postadaki bağlantıya basar → Brevo onu bu sayfaya
      ?h=<slug>&t=<token> ile geri yönlendirir.
   3) Bu dosya token'ı fonksiyona gönderir → 10 dakika geçerli,
      imzalı bir indirme bağlantısı gelir. PDF'ler özel (private) durur.
   Adres Brevo'da zaten kayıtlıysa onay e-postası gitmez, indirme hemen gelir.
   ============================================================ */
(function () {
  'use strict';

  var BASE = 'https://wxjudojlwksivhzjnmim.supabase.co/functions/v1/';
  var FN = BASE + 'handout-download';

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
      '<p class="bbh-lead">Adını ve e-posta adresini yaz. Sana bir onay e-postası göndereceğiz; bağlantıya basınca PDF indirme sayfan açılır.</p>' +
      '<label class="bbh-field"><span>Adın</span>' +
        '<input type="text" id="bbh-name" autocomplete="given-name" maxlength="80"></label>' +
      '<label class="bbh-field"><span>E-posta adresin</span>' +
        '<input type="email" id="bbh-email" autocomplete="email" inputmode="email" maxlength="254"></label>' +
      '<div class="bbh-hp" aria-hidden="true"><label>Web sitesi' +
        '<input type="text" id="bbh-web" tabindex="-1" autocomplete="off"></label></div>' +
      '<label class="bbh-consent">' +
        '<input type="checkbox" id="bbh-news">' +
        '<span>PDF\'i almak için bültene kayıt olmak ve yeni videolardan ile rehberlerden ' +
          'e-posta ile haberdar olmak istiyorum. Kayıt, onay e-postasındaki bağlantıya ' +
          'basınca tamamlanır; basmadan bülten gönderilmez. Bu izni istediğim zaman, her ' +
          'e-postanın altındaki bağlantıyla geri alabilirim.</span>' +
      '</label>' +
      '<button class="bbh-btn" id="bbh-send" type="button">Onay e-postası gönder</button>' +
      '<div class="bbh-msg" id="bbh-msg"></div>' +
      '<p class="bbh-note">Adın ve e-posta adresin bu indirme ve bülten kaydı için saklanır. ' +
        'Reklam yok, adresin kimseyle paylaşılmaz. ' +
        '<a href="legal.html" target="_blank" rel="noopener">Gizlilik</a></p>' +
      '</div>';
  }

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }

  function showDownload(box, url, intro) {
    var wrap = el('div', 'bbh-done');
    wrap.appendChild(el('div', 'bbh-mark', '📄'));
    wrap.appendChild(el('h3', '', 'PDF hazır'));
    if (intro) wrap.appendChild(el('p', 'bbh-lead', intro));
    var a = el('a', 'bbh-btn', 'PDF\'i indir'); a.href = url; a.setAttribute('download', ''); a.rel = 'noopener';
    wrap.appendChild(a);
    wrap.appendChild(el('p', 'bbh-lead', 'Bu bağlantı 10 dakika geçerli. Süre dolarsa onay e-postasındaki bağlantıya yeniden basabilirsin.'));
    box.innerHTML = ''; box.appendChild(wrap);
  }

  function showConfirm(box, mail) {
    var wrap = el('div', 'bbh-done');
    wrap.appendChild(el('div', 'bbh-mark', '📬'));
    wrap.appendChild(el('h3', '', 'E-postana bak'));
    wrap.appendChild(el('p', 'bbh-lead', mail + ' adresine bir onay bağlantısı gönderdik. Bağlantıya basınca bülten kaydın tamamlanır ve PDF indirme sayfan açılır. Bağlantıya basmadan PDF gelmez ve sana bülten göndermeyiz.'));
    wrap.appendChild(el('p', 'bbh-lead', 'Gelmediyse spam klasörüne bakmayı unutma.'));
    box.innerHTML = ''; box.appendChild(wrap);
  }

  function post(action, payload) {
    return fetch(FN + '?action=' + action, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) { var e = new Error('http ' + r.status); e.status = r.status; throw e; }
      return r.json();
    });
  }

  function attach(box) {
    if (box.dataset.bbhReady === '1') return;
    box.dataset.bbhReady = '1';
    var slug = (box.dataset.slug || '').trim();
    var title = box.dataset.title || '';
    box.className = 'bbh';

    function form(prefillMsg) {
      box.innerHTML = markup(title);
      var nameI = box.querySelector('#bbh-name');
      var email = box.querySelector('#bbh-email');
      var web   = box.querySelector('#bbh-web');
      var news  = box.querySelector('#bbh-news');
      var btn   = box.querySelector('#bbh-send');
      var msg   = box.querySelector('#bbh-msg');
      function say(text, kind) { msg.className = 'bbh-msg' + (kind ? ' ' + kind : ''); msg.textContent = text; }
      function looksLikeEmail(v) { return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(v); }
      if (prefillMsg) say(prefillMsg, 'err');

      async function submit() {
        var n = (nameI.value || '').trim();
        var v = (email.value || '').trim();
        say('');
        if (n.length < 2)        { say('Adını yaz.', 'err'); nameI.focus(); return; }
        if (!looksLikeEmail(v))  { say('Geçerli bir e-posta adresi yaz.', 'err'); email.focus(); return; }
        if (!news.checked)       { say('PDF\'i almak için bülten kutucuğunu işaretle.', 'err'); return; }
        if (!slug)               { say('Rehber seçilmedi.', 'err'); return; }

        btn.disabled = true;
        var old = btn.textContent; btn.textContent = 'Gönderiliyor…';
        try {
          var data = await post('request', { name: n, email: v, slug: slug, newsletter: true, website: web.value || '' });
          if (data && data.status === 'ready' && data.url) showDownload(box, data.url, '');
          else if (data && data.status === 'confirm') showConfirm(box, v);
          else throw new Error('unexpected response');
        } catch (e) {
          console.error('handout request failed:', e);
          var t = 'Şu an gönderilemedi — sorun bizde. Biraz sonra tekrar dener misin?';
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

    // Brevo, onay bağlantısından sonra buraya ?t=<token> ile döner.
    var token = new URLSearchParams(location.search).get('t');
    if (token && slug) {
      box.innerHTML = '';
      box.appendChild(el('p', 'bbh-lead', 'E-postan onaylandı, PDF hazırlanıyor…'));
      post('download', { slug: slug, token: token }).then(function (d) {
        if (!d || !d.url) throw new Error('no url');
        showDownload(box, d.url, 'E-postanı onayladığın için teşekkürler! Bülten kaydın tamamlandı.');
      }).catch(function (e) {
        console.error('handout token failed:', e);
        form(e.status === 403 || e.status === 404
          ? 'Bu bağlantı geçersiz ya da süresi dolmuş. Formu yeniden doldurursan yeni bir onay e-postası göndeririz.'
          : 'Şu an hazırlanamadı. Biraz sonra bu sayfayı yenile.');
      });
      return;
    }
    form('');
  }

  function init() {
    var boxes = document.querySelectorAll('[data-bb-handout]');
    if (!boxes.length) return;
    styles();
    boxes.forEach(attach);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
