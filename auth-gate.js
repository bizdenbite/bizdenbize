/* ============================================================
   BizdenBize — erişim kapısı.  (v2)

   <head> içinde, diğer script'lerden ÖNCE:
     <script src="auth-gate.js"></script>

   v2 DÜZELTMESİ — ÖNEMLİ:
   Google ile giriş, oturumu URL'de geri gönderir:
     ?code=...            (PKCE akışı)
     #access_token=...    (implicit akış)
   Supabase istemcisi bunu OKUYUP localStorage'a yazar. Bu dosya
   daha önce çalıştığı için localStorage'ı boş görüp kullanıcıyı
   login'e atıyordu — ve Google'ın az önce verdiği oturum çöpe
   gidiyordu. Sonsuz giriş döngüsü.
   Artık URL'de böyle bir dönüş varsa kapı HİÇ çalışmaz.
   ============================================================ */
(function () {
  'use strict';

  var PROJECT_REF = 'wxjudojlwksivhzjnmim';
  var LOGIN_URL   = 'login.html';

  // ---- 1) Kimlik doğrulama dönüşü mü? Öyleyse hiç karışma. ----
  var hash   = window.location.hash   || '';
  var search = window.location.search || '';

  var isAuthCallback =
        hash.indexOf('access_token')  !== -1 ||
        hash.indexOf('refresh_token') !== -1 ||
        hash.indexOf('error')         !== -1 ||
        hash.indexOf('type=')         !== -1 ||   // recovery / invite / magiclink
        /[?&]code=/.test(search)               ||
        /[?&]error/.test(search)               ||
        /[?&]token_hash=/.test(search);

  if (isAuthCallback) return;

  // ---- 2) Oturum var mı? (ağ beklemeden) ----
  function hasSession() {
    try {
      var raw = window.localStorage.getItem('sb-' + PROJECT_REF + '-auth-token');
      if (!raw) return false;

      var s = JSON.parse(raw);
      if (!s) return false;

      // Supabase sürümüne göre token doğrudan veya .currentSession içinde olur.
      var sess = s.currentSession || s;
      if (!sess || !sess.access_token) return false;

      if (sess.expires_at && (sess.expires_at * 1000) < Date.now()) {
        // Süresi dolmuş ama yenileme token'ı varsa istemci tazeleyebilir.
        return !!sess.refresh_token;
      }
      return true;
    } catch (e) {
      // localStorage kapalı/bozuk: kapıyı kapatma. Üyeyi yanlışlıkla
      // dışarıda bırakmak, misafiri içeride bırakmaktan daha kötü —
      // asıl koruma zaten RLS'te.
      return true;
    }
  }

  if (hasSession()) return;

  // ---- 3) Oturum yok: giriş sayfasına ----
  try {
    window.sessionStorage.setItem(
      'bb_redirect_after_login',
      window.location.pathname + window.location.search
    );
  } catch (e) { /* önemsiz */ }

  window.location.replace(LOGIN_URL);
})();
