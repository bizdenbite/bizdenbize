-- ============================================================
-- BizdenBize · Görüşler — Videothek ile birleştirme
-- ------------------------------------------------------------
-- Görüşler artık üç tür içerik taşır: yazı, video, ses.
-- Videothek'teki videolar buraya taşınır.
--
-- Bu dosyayı OLDUĞU GİBİ Supabase SQL Editor'da çalıştır.
-- BEGIN/COMMIT içinde: ya tamamı uygulanır ya hiçbiri.
--
-- İKİ DURUMDA DA ÇALIŞIR:
--   * blog_schema.sql'i hiç çalıştırmadıysan → tabloyu kurar.
--   * çalıştırdıysan → üstüne yeni alanları ekler.
--
-- `videos` TABLOSU SİLİNMEZ. Veriler kopyalanır, orijinali
-- yerinde durur. Her şey yolundaysa sonra temizleriz —
-- geri dönüşü olmayan adımı bugün atmıyoruz.
-- ============================================================

BEGIN;

-- ── YARDIMCILAR ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bb_is_approved()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'approved');
$$;

CREATE OR REPLACE FUNCTION public.bb_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() = '3e96d976-5c3a-4270-af88-6172f1751f9a'::uuid
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true);
$$;

-- Türkçe başlıktan URL üretir: "İş & Göç — 2026" → "is-goc-2026"
CREATE OR REPLACE FUNCTION public.bb_slugify(t text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT left(
    trim(both '-' from
      regexp_replace(
        regexp_replace(
          lower(translate(coalesce(t,''),
            'çğıİöşüÇĞÖŞÜÂÎÛâîû',
            'cgiiosucgosuaiuaiu')),
          '[^a-z0-9]+', '-', 'g'),
        '-+', '-', 'g')
    ), 80);
$$;

-- ── TABLO ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id            bigserial PRIMARY KEY,
  slug          text        NOT NULL UNIQUE,
  title         text        NOT NULL CHECK (btrim(title) <> ''),
  excerpt       text,
  body          text,
  cover_url     text,
  category      text        NOT NULL DEFAULT 'Genel',
  author_id     uuid        NOT NULL DEFAULT '3e96d976-5c3a-4270-af88-6172f1751f9a'::uuid
                              REFERENCES public.profiles(id) ON DELETE RESTRICT,
  is_published  boolean     NOT NULL DEFAULT false,
  published_at  timestamptz,
  comment_count int         NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Yeni alanlar (blog_schema.sql daha önce çalıştıysa buradan eklenir)
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS media_type  text    NOT NULL DEFAULT 'text';
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS youtube_id  text;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS audio_url   text;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS is_vertical boolean NOT NULL DEFAULT false;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS sort_order  int     NOT NULL DEFAULT 100;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS is_welcome  boolean NOT NULL DEFAULT false;

-- body artık zorunlu değil: videonun gövdesi olmayabilir.
ALTER TABLE public.blog_posts ALTER COLUMN body DROP NOT NULL;
ALTER TABLE public.blog_posts DROP CONSTRAINT IF EXISTS blog_posts_body_check;

-- Her türün kendi zorunlu alanı var. Boş bir video kaydı
-- oluşturulamasın diye kural veritabanında duruyor.
ALTER TABLE public.blog_posts DROP CONSTRAINT IF EXISTS blog_posts_media_shape;
ALTER TABLE public.blog_posts ADD CONSTRAINT blog_posts_media_shape CHECK (
  (media_type = 'text'  AND btrim(coalesce(body,''))       <> '')
  OR (media_type = 'video' AND btrim(coalesce(youtube_id,'')) <> '')
  OR (media_type = 'audio' AND btrim(coalesce(audio_url,''))  <> '')
);

ALTER TABLE public.blog_posts DROP CONSTRAINT IF EXISTS blog_posts_media_type_check;
ALTER TABLE public.blog_posts ADD CONSTRAINT blog_posts_media_type_check
  CHECK (media_type IN ('text','video','audio'));

CREATE INDEX IF NOT EXISTS blog_posts_pub_idx   ON public.blog_posts (is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS blog_posts_cat_idx   ON public.blog_posts (category);
CREATE INDEX IF NOT EXISTS blog_posts_media_idx ON public.blog_posts (media_type);

-- ── YORUMLAR ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blog_comments (
  id            bigserial PRIMARY KEY,
  post_id       bigint      NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES public.profiles(id)   ON DELETE CASCADE,
  body          text        NOT NULL CHECK (btrim(body) <> '' AND length(body) <= 2000),
  status        text        NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden')),
  hidden_by     uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  hidden_at     timestamptz,
  hidden_reason text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS blog_comments_post_idx   ON public.blog_comments (post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS blog_comments_status_idx ON public.blog_comments (status, created_at DESC);

-- ── RLS: İÇERİK ─────────────────────────────────────────────
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blog_posts_public_read" ON public.blog_posts;
DROP POLICY IF EXISTS "blog_posts_admin_read"  ON public.blog_posts;
DROP POLICY IF EXISTS "blog_posts_admin_write" ON public.blog_posts;
DROP POLICY IF EXISTS "blog_posts_admin_edit"  ON public.blog_posts;
DROP POLICY IF EXISTS "blog_posts_admin_del"   ON public.blog_posts;

CREATE POLICY "blog_posts_public_read" ON public.blog_posts
  FOR SELECT USING (is_published = true);
CREATE POLICY "blog_posts_admin_read" ON public.blog_posts
  FOR SELECT USING (public.bb_is_admin());
CREATE POLICY "blog_posts_admin_write" ON public.blog_posts
  FOR INSERT WITH CHECK (public.bb_is_admin());
CREATE POLICY "blog_posts_admin_edit" ON public.blog_posts
  FOR UPDATE USING (public.bb_is_admin()) WITH CHECK (public.bb_is_admin());
CREATE POLICY "blog_posts_admin_del" ON public.blog_posts
  FOR DELETE USING (public.bb_is_admin());

-- ── RLS: YORUMLAR ───────────────────────────────────────────
ALTER TABLE public.blog_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blog_comments_member_read"  ON public.blog_comments;
DROP POLICY IF EXISTS "blog_comments_admin_read"   ON public.blog_comments;
DROP POLICY IF EXISTS "blog_comments_member_write" ON public.blog_comments;
DROP POLICY IF EXISTS "blog_comments_admin_edit"   ON public.blog_comments;
DROP POLICY IF EXISTS "blog_comments_admin_del"    ON public.blog_comments;

CREATE POLICY "blog_comments_member_read" ON public.blog_comments
  FOR SELECT USING (status = 'visible' AND public.bb_is_approved());
CREATE POLICY "blog_comments_admin_read" ON public.blog_comments
  FOR SELECT USING (public.bb_is_admin());
CREATE POLICY "blog_comments_member_write" ON public.blog_comments
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND status = 'visible'
    AND public.bb_is_approved()
    AND EXISTS (SELECT 1 FROM public.blog_posts p WHERE p.id = post_id AND p.is_published = true)
  );
CREATE POLICY "blog_comments_admin_edit" ON public.blog_comments
  FOR UPDATE USING (public.bb_is_admin()) WITH CHECK (public.bb_is_admin());
CREATE POLICY "blog_comments_admin_del" ON public.blog_comments
  FOR DELETE USING (public.bb_is_admin());

-- ── TRIGGER'LAR ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.blog_comment_stamp_hidden()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'hidden' AND OLD.status IS DISTINCT FROM 'hidden' THEN
    NEW.hidden_by := auth.uid();
    NEW.hidden_at := now();
  ELSIF NEW.status = 'visible' THEN
    NEW.hidden_by := NULL; NEW.hidden_at := NULL; NEW.hidden_reason := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS blog_comments_stamp_hidden ON public.blog_comments;
CREATE TRIGGER blog_comments_stamp_hidden
  BEFORE UPDATE ON public.blog_comments
  FOR EACH ROW EXECUTE FUNCTION public.blog_comment_stamp_hidden();

CREATE OR REPLACE FUNCTION public.blog_recount_comments()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid bigint;
BEGIN
  pid := COALESCE(NEW.post_id, OLD.post_id);
  UPDATE public.blog_posts p
     SET comment_count = (SELECT count(*) FROM public.blog_comments c
                          WHERE c.post_id = pid AND c.status = 'visible')
   WHERE p.id = pid;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS blog_comments_recount ON public.blog_comments;
CREATE TRIGGER blog_comments_recount
  AFTER INSERT OR UPDATE OR DELETE ON public.blog_comments
  FOR EACH ROW EXECUTE FUNCTION public.blog_recount_comments();

CREATE OR REPLACE FUNCTION public.blog_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS blog_posts_touch_updated ON public.blog_posts;
CREATE TRIGGER blog_posts_touch_updated
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.blog_touch_updated_at();

-- ── VİDEOLARI TAŞI ──────────────────────────────────────────
-- videos tablosunun hangi sütunlara sahip olduğunu varsaymıyoruz:
-- önce bakıyoruz, sonra ona göre kopyalıyoruz. Aynı youtube_id
-- ikinci kez taşınmaz, yani bu bölüm tekrar tekrar çalıştırılabilir.
DO $mig$
DECLARE
  has_videos  boolean;
  c_created   boolean;
  c_sort      boolean;
  c_welcome   boolean;
  c_vertical  boolean;
  moved       int;
  e_created   text;
  e_sort      text;
  e_welcome   text;
  e_vertical  text;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='videos') INTO has_videos;
  IF NOT has_videos THEN
    RAISE NOTICE 'videos tablosu yok — taşınacak bir şey bulunamadı.';
    RETURN;
  END IF;

  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
          AND table_name='videos' AND column_name='created_at')  INTO c_created;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
          AND table_name='videos' AND column_name='sort_order')  INTO c_sort;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
          AND table_name='videos' AND column_name='is_welcome')  INTO c_welcome;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
          AND table_name='videos' AND column_name='is_vertical') INTO c_vertical;

  e_created  := CASE WHEN c_created  THEN 'coalesce(v.created_at, now())' ELSE 'now()' END;
  e_sort     := CASE WHEN c_sort     THEN 'coalesce(v.sort_order, 100)'   ELSE '100'   END;
  e_welcome  := CASE WHEN c_welcome  THEN 'coalesce(v.is_welcome, false)' ELSE 'false' END;
  e_vertical := CASE WHEN c_vertical THEN 'coalesce(v.is_vertical, false)' ELSE 'false' END;

  EXECUTE format($sql$
    INSERT INTO public.blog_posts
      (slug, title, excerpt, category, media_type, youtube_id,
       is_vertical, sort_order, is_welcome, is_published, published_at, created_at)
    SELECT
      public.bb_slugify(v.title) || '-' || v.id::text,
      v.title,
      nullif(btrim(coalesce(v.description,'')), ''),
      coalesce(nullif(btrim(v.category),''), 'Genel'),
      'video',
      v.youtube_id,
      %s, %s, %s,
      coalesce(v.is_published, false),
      CASE WHEN coalesce(v.is_published,false) THEN %s ELSE NULL END,
      %s
    FROM public.videos v
    WHERE btrim(coalesce(v.youtube_id,'')) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM public.blog_posts p
        WHERE p.youtube_id = v.youtube_id AND p.media_type = 'video')
  $sql$, e_vertical, e_sort, e_welcome, e_created, e_created);

  GET DIAGNOSTICS moved = ROW_COUNT;
  RAISE NOTICE 'Görüşler''e taşınan video sayısı: %', moved;
END $mig$;

COMMIT;

-- ============================================================
-- ÇALIŞTIRDIKTAN SONRA KONTROL ET:
--
-- 1) Ne taşındı?
--    SELECT media_type, count(*), count(*) FILTER (WHERE is_published) AS yayinda
--    FROM public.blog_posts GROUP BY media_type;
--
-- 2) Aynı video iki kez mi girmiş? (Videothek'teki mükerrer
--    tanıtım videosunu hatırla — burada da görünür.)
--    SELECT youtube_id, count(*), string_agg(title, ' | ')
--    FROM public.blog_posts WHERE media_type='video'
--    GROUP BY youtube_id HAVING count(*) > 1;
--
-- 3) Politikalar yerinde mi? (10 satır beklenir)
--    SELECT tablename, policyname, cmd FROM pg_policies
--    WHERE tablename IN ('blog_posts','blog_comments')
--    ORDER BY tablename, cmd;
-- ============================================================
