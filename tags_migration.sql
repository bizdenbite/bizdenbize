-- ═══════════════════════════════════════════════════════════
-- BizdenBize · Görüşler — Schlagwörter (Etiketler)
--
-- `category` bleibt, wie es ist: EIN Oberbegriff pro Beitrag,
-- der die Filterleiste steuert. `tags` kommt daneben: mehrere
-- freie Schlagwörter, nach denen gefiltert werden kann.
--
-- VORAUSSETZUNG: gorusler_migration.sql ist gelaufen.
-- Gefahrlos wiederholbar.
-- ═══════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

-- GIN-Index: ohne ihn wird die Suche "enthält Schlagwort X"
-- mit jedem Beitrag langsamer.
CREATE INDEX IF NOT EXISTS blog_posts_tags_idx
  ON public.blog_posts USING gin (tags);

COMMIT;

-- ═══════════════════════════════════════════════════════════
-- Welche Schlagwörter sind im Umlauf? (gegen Dubletten wie
-- "gurbet" / "Gurbet" / "gurbet ")
--
--   SELECT tag, count(*) FROM public.blog_posts,
--          unnest(tags) AS tag GROUP BY tag ORDER BY count(*) DESC;
-- ═══════════════════════════════════════════════════════════
