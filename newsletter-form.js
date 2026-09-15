/* ============================================================
   BizdenBize — Bülten kayıt formu (ortak bileşen)
   ------------------------------------------------------------
   Sayfaya şunu koy, gerisini bu dosya halleder:
     <div data-bb-newsletter></div>
     <script src="newsletter-form.js" defer></script>

   Tek yerde duruyor: metin ya da tasarım değişirse tek dosya.
   Formun 40 yere kopyalanmasının nasıl bittiğini Keşfet
   menüsünde gördük.

   ÖNEMLİ — çift onay (Double-Opt-In):
   Form yalnızca kaydı BAŞLATIR. Adres, gelen e-postadaki
   bağlantıya basılana kadar onaylanmış sayılmaz ve o ana
   kadar kimseye bülten gönderilmez. Almanya'da başka türlüsü
   yasal değil. Bu yüzden başarı mesajı "kaydoldun" demez,
   "e-postana bak" der — çünkü olan tam olarak budur.
   ============================================================ */
(function () {
  'use strict';

  var FN = 'https://wxjudojlwksivhzjnmim.supabase.co/functions/v1/newsletter';

  var CSS = [
    '.bbn{background:#fff;border:1px solid var(--sand,#D4C5A9);border-radius:16px;',
      'padding:26px 24px;margin:44px 0 8px;}',
    '.bbn h3{font-family:Georgia,\'Playfair Display\',serif;font-size:20px;font-weight:700;',
      'color:var(--ink,#1A1208);margin:0 0 8px;line-height:1.3;}',
    '.bbn p.bbn-lead{font-size:14.5px;line-height:1.65;color:var(--muted,#6B5E4E);margin:0 0 18px;}',
    '.bbn-row{display:flex;gap:9px;flex-wrap:wrap;}',
    '.bbn-row input[type=email]{flex:1;min-width:200px;padding:12px 14px;font-family:inherit;',
      'font-size:15px;border:1px solid var(--sand,#D4C5A9);border-radius:10px;',
      'background:var(--cream,#FAF7F2);color:var(--ink,#1A1208);}',
    '.bbn-row input[type=email]:focus{outline:none;border-color:var(--red,#D42B2B);}',
    '.bbn-btn{border:none;border-radius:10px;padding:12px 22px;font-family:inherit;font-size:14.5px;',
      'font-weight:600;background:var(--red,#D42B2B);color:#fff;cursor:pointer;white-space:nowrap;}',
    '.bbn-btn:hover{background:var(--red2,#E8393A);}',
    '.bbn-btn:disabled{opacity:.55;cursor:default;}',
    '.bbn-consent{display:flex;gap:9px;align-items:flex-start;margin-top:14px;',
      'font-size:12.5px;line-height:1.6;color:var(--muted,#6B5E4E);}',
    '.bbn-consent input{margin:2px 0 0;flex-shrink:0;width:16px;height:16px;}',
    '.bbn-consent a{color:var(--red,#D42B2B);}',
    '.bbn-msg{font-size:13.5px;line-height:1.6;margin-top:12px;}',
    '.bbn-msg.err{color:var(--red,#D42B2B);}',
    '.bbn-msg.ok{color:#1E7B4B;}',
    '.bbn-done{text-align:center;padding:8px 0;}',
    '.bbn-done .bbn-mark{font-size:34px;margin-bottom:6px;}'
  ].join('');

  function styles() {
    if (document.getElementById('bbn-style')) return;
    var st = document.createElement('style');
    st.id = 'bbn-style';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function markup() {
    return '' +
      '<h3>Yeni yazılardan haberdar ol</h3>' +
      '<p class="bbn-lead">Yeni yazılardan ve mahalledeki gelişmelerden haberdar olmak ' +
        'için kayıt ol. Ne sıklıkta yazarsak o kadar — reklam yok, adresin ' +
        'kimseyle paylaşılmaz.</p>' +
      '<div class="bbn-row">' +
        '<input type="email" id="bbn-email" placeholder="e-posta adresin" ' +
          'autocomplete="email" inputmode="email" maxlength="254">' +
        '<button class="bbn-btn" id="bbn-send" type="button">Kayıt Ol</button>' +
      '</div>' +
      '<label class="bbn-consent">' +
        '<input type="checkbox" id="bbn-ok">' +
        '<span>Yeni yazılardan ve mahalledeki gelişmelerden e-posta ile haberdar olmak ' +
          'istiyorum. Bu izni istediğim zaman, her e-postanın altındaki bağlantıyla geri ' +
          'alabilirim. <a href="legal.html" target="_blank">Gizlilik</a></span>' +
      '</label>' +
      '<div class="bbn-msg" id="bbn-msg"></div>';
  }

  function attach(box) {
    // Nur einmal aufbauen. Läuft init() ein zweites Mal (zwei
    // Skript-Einbindungen, nachgeladener Inhalt), würde ein
    // erneutes innerHTML die schon getippte Adresse löschen.
    if (box.dataset.bbnReady === '1') return;
    box.dataset.bbnReady = '1';
    box.className = 'bbn';
    box.innerHTML = markup();

    var email = box.querySelector('#bbn-email');
    var check = box.querySelector('#bbn-ok');
    var btn   = box.querySelector('#bbn-send');
    var msg   = box.querySelector('#bbn-msg');

    function say(text, kind) {
      msg.className = 'bbn-msg' + (kind ? ' ' + kind : '');
      msg.textContent = text;
    }

    function looksLikeEmail(v) {
      return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(v);
    }

    async function submit() {
      var v = (email.value || '').trim();
      say('');

      if (!looksLikeEmail(v)) { say('Geçerli bir e-posta adresi yaz.', 'err'); email.focus(); return; }
      if (!check.checked)     { say('Devam etmek için kutucuğu işaretle.', 'err'); return; }

      btn.disabled = true;
      var old = btn.textContent;
      btn.textContent = 'Gönderiliyor…';

      try {
        var r = await fetch(FN + '?action=subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: v })
        });
        if (!r.ok) {
          // 400 = Adresse abgelehnt; alles andere ist unser Problem,
          // nicht das der Person. Das soll die Meldung auch sagen.
          var why = r.status === 400 ? 'invalid' : 'server';
          throw Object.assign(new Error('http ' + r.status), { why: why });
        }

        // Onay maili gitti. "Kaydoldun" DEMİYORUZ: kayıt,
        // bağlantıya basılınca tamamlanır.
        box.innerHTML =
          '<div class="bbn-done"><div class="bbn-mark">📬</div>' +
          '<h3>E-postana bak</h3>' +
          '<p class="bbn-lead">' + v.replace(/[<>&"]/g, '') + ' adresine bir onay bağlantısı gönderdik. ' +
          'Bağlantıya basmadan kayıt tamamlanmaz ve sana hiçbir e-posta göndermeyiz.<br>' +
          'Gelmediyse spam klasörüne bakmayı unutma.</p></div>';
      } catch (e) {
        console.error('newsletter signup failed:', e);
        say(e && e.why === 'invalid'
          ? 'Bu adres kabul edilmedi. Yazımını bir kontrol eder misin?'
          : 'Şu an gönderilemedi — sorun bizde. Biraz sonra tekrar dener misin?', 'err');
        btn.disabled = false;
        btn.textContent = old;
      }
    }

    btn.addEventListener('click', submit);
    email.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
    });
  }

  function init() {
    var boxes = document.querySelectorAll('[data-bb-newsletter]');
    if (!boxes.length) return;
    styles();
    boxes.forEach(attach);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
