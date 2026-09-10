-- ═══════════════════════════════════════════════════════════
-- BizdenBize — Görüşler: dış platformdaki podcast'ler
--
-- Podcast'ler Spotify / Apple / Buzzsprout gibi bir serviste
-- yayınlanıyor, BizdenBize'de o servisin oynatıcısı gömülüyor.
-- Böylece bölüm hem podcast uygulamalarında bulunuyor hem de
-- burada dinlenebiliyor; indirme sayıları da serviste kalıyor.
--
-- ÖNKOŞUL: gorusler_migration.sql çalışmış olmalı.
-- Bu dosya güvenle tekrar çalıştırılabilir.
-- ═══════════════════════════════════════════════════════════

BEGIN;

-- Gömülü oynatıcının adresi. HAM HTML SAKLANMIYOR — sadece
-- adres. iframe'i sayfa kendisi kuruyor ve yalnızca tanınan
-- platformlara izin veriyor. Yapıştırılan HTML'i olduğu gibi
-- basmak, sayfaya yabancı kod sokmanın en kolay yoludur.
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS embed_url text;

-- Ses içeriği artık iki yoldan biriyle var olabilir:
-- ya bize yüklenmiş dosya, ya dış platformun oynatıcısı.
ALTER TABLE public.blog_posts DROP CONSTRAINT IF EXISTS blog_posts_media_shape;
ALTER TABLE public.blog_posts ADD CONSTRAINT blog_posts_media_shape CHECK (
  (media_type = 'text'  AND btrim(coalesce(body,''))       <> '')
  OR (media_type = 'video' AND btrim(coalesce(youtube_id,'')) <> '')
  OR (media_type = 'audio' AND (
        btrim(coalesce(audio_url,'')) <> '' OR btrim(coalesce(embed_url,'')) <> ''
     ))
);

COMMIT;

-- ═══════════════════════════════════════════════════════════
-- KONTROL:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'blog_posts' AND column_name = 'embed_url';
-- ═══════════════════════════════════════════════════════════
