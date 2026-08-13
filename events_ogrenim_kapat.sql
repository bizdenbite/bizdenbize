-- ============================================================
-- Karar değişikliği: events ve ogrenim artık herkese açık DEĞİL.
--
-- Sayfalara auth-gate.js eklendi. Ancak sayfayı kapatmak yetmez:
-- events_public view'ı hâlâ anon rolüne açıktı, yani yayın anahtarı
-- ile doğrudan REST üzerinden okunabilirdi. Asıl kapı burası.
--
-- ogrenim.html veritabanı okumuyor — orada SQL değişikliği gerekmez.
-- ============================================================

BEGIN;

revoke select on public.events_public from anon;

-- Giriş yapmış üyeler için erişim korunur: sayfalar oturum yoksa
-- events_public'e düşüyor, o yüzden authenticated hakkı KALSIN.
grant select on public.events_public to authenticated;

COMMIT;


-- ============================================================
-- KONTROL — events_public üzerinde anon hakkı kalmamalı.
-- Boş dönmeli.
-- ============================================================
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name   = 'events_public'
  and grantee      = 'anon';
