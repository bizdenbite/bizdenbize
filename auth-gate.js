/* ============================================================
   BizdenBize — erişim kapısı.

   <head> içinde, DİĞER script'lerden ÖNCE çağrılır:
     <script src="auth-gate.js"></script>

   Neden burada ve neden senkron:
   Sayfa sonunda çalışan bir kontrol, içerik ZATEN çizildikten
   sonra yönlendirir — giriş yapmamış ziyaretçi içeriği bir an
   görür. Bu dosya sayfayı çizilmeden gizler, oturumu localStorage'
   dan (ağ beklemeden) okur ve gerekirse hemen yönlendirir.

   NOT: Bu bir kilit değil, kapıdır. Asıl koruma RLS'tedir —
   veriye erişimi politikalar belirler. Burası sadece giriş
   yapmamış ziyaretçinin boş sayfada dolaşmasını engeller.
   ============================================================ */
(function () {
  'use strict';

  var PROJECT_REF = 'wxjudojlwksivhzjnmim';
  var LOGIN_URL   = 'login.html';

  // Bu dosyayı yükleyen her sayfa korumalıdır. Herkese açık
  // sayfalar (index, login, yasal sayfalar, videolar, library,
  // saglik, ogrenim, premium, events) bu script'i ÇAĞIRMAZ.

  function hasSession() {
    try {
      // Supabase oturumu: sb-<ref>-auth-token
      var raw = window.localStorage.getItem('sb-' + PROJECT_REF + '-auth-token');
      if (!raw) return false;

      var s = JSON.parse(raw);
      if (!s || !s.access_token) return false;

      // Süresi dolmuş token'ı oturum sayma. expires_at saniye cinsinden.
      if (s.expires_at && (s.expires_at * 1000) < Date.now()) {
        // Yenileme token'ı varsa Supabase istemcisi tazeleyebilir —
        // kapıyı kapatma, sayfanın kendi mantığına bırak.
        return !!s.refresh_token;
      }
      return true;
    } catch (e) {
      // localStorage kapalı/bozuksa kapıyı kapatma; sayfanın kendi
      // oturum kontrolü devreye girsin. Yanlışlıkla üyeyi dışarıda
      // bırakmak, misafiri içeride bırakmaktan daha kötü.
      return true;
    }
  }

  if (!hasSession()) {
    // Nereye gitmek istediğini sakla ki girişten sonra oraya dönsün.
    try {
      window.sessionStorage.setItem(
        'bb_redirect_after_login',
        window.location.pathname + window.location.search
      );
    } catch (e) { /* önemsiz */ }

    // replace(): geri tuşu korumalı sayfaya geri döndürmesin.
    window.location.replace(LOGIN_URL);
    return;
  }

  // Oturum var: sayfayı normal çizdir. (Gizleme stili hiç
  // eklenmediği için burada yapılacak bir şey yok — gizleme
  // yalnızca yönlendirme yolunda gerekli ve orada zaten
  // sayfadan çıkıyoruz.)
})();
