-- ═══════════════════════════════════════════════════════════
-- BizdenBize — Podcast / ses kayıtları için Storage bucket
-- Run ONCE in Supabase → SQL Editor.
--
-- business-photos bucket'ından bir farkı var: oraya her üye
-- yükleyebiliyor, buraya SADECE admin. Podcast'ler senin
-- yayınların; üyelerin bu bucket'a dosya bırakmasına gerek yok.
--
-- ÖNKOŞUL: gorusler_migration.sql önce çalışmış olmalı
-- (public.bb_is_admin() oradan geliyor).
-- ═══════════════════════════════════════════════════════════

-- ── Süre alanı ──────────────────────────────────────────────
-- Liste sayfasında "32 dk" yazabilmek için. Tarayıcı dosyayı
-- okurken süreyi kendisi bulur; elle girmiyorsun.
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS duration_seconds int;

-- ── Bucket ──────────────────────────────────────────────────
-- 100 MB sınır: 60 dakikalık bir kayıt 64 kbps mono mp3'te
-- yaklaşık 28 MB tutar, yani bolca yer var.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'podcasts', 'podcasts', true, 104857600,
  ARRAY['audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/aac','audio/wav','audio/ogg']
)
ON CONFLICT (id) DO UPDATE
  SET public             = true,
      file_size_limit    = 104857600,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── Herkes dinleyebilir ─────────────────────────────────────
DROP POLICY IF EXISTS "Public read podcasts" ON storage.objects;
CREATE POLICY "Public read podcasts" ON storage.objects
  FOR SELECT USING (bucket_id = 'podcasts');

-- ── Yükleme / değiştirme / silme: yalnızca admin ────────────
DROP POLICY IF EXISTS "Admin upload podcasts" ON storage.objects;
CREATE POLICY "Admin upload podcasts" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'podcasts' AND public.bb_is_admin());

DROP POLICY IF EXISTS "Admin update podcasts" ON storage.objects;
CREATE POLICY "Admin update podcasts" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'podcasts' AND public.bb_is_admin());

DROP POLICY IF EXISTS "Admin delete podcasts" ON storage.objects;
CREATE POLICY "Admin delete podcasts" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'podcasts' AND public.bb_is_admin());

-- ═══════════════════════════════════════════════════════════
-- SONRA KONTROL ET:
--
--   SELECT id, public, file_size_limit, allowed_mime_types
--   FROM storage.buckets WHERE id = 'podcasts';
--
-- NOT: Projenin GENEL yükleme sınırı bucket sınırından düşükse
-- düşük olan geçerlidir. Dashboard → Storage → Settings →
-- "Upload file size limit" değerini kontrol et; 50 MB ise
-- uzun kayıtlar için yükselt.
-- ═══════════════════════════════════════════════════════════
