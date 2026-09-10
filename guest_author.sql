-- ═══════════════════════════════════════════════════════════
-- BizdenBize · Görüşler — Gastbeiträge
--
-- Kein Einreichungsformular, keine Warteschlange, keine neuen
-- RLS-Regeln: Beiträge werden weiterhin ausschließlich von der
-- Administratorin angelegt. Neu ist nur, dass ein Beitrag einen
-- ANDEREN Autor ausweisen kann als das Konto, das ihn einträgt.
--
-- author_id bleibt unverändert und zeigt weiter auf das Konto,
-- das den Beitrag veröffentlicht hat — das ist die technische
-- Verantwortlichkeit. author_name ist die Nennung nach außen.
-- Beides sollte man nicht vermischen.
--
-- VORAUSSETZUNG: gorusler_migration.sql ist gelaufen.
-- Gefahrlos wiederholbar.
-- ═══════════════════════════════════════════════════════════

BEGIN;

-- Leer  = eigener Beitrag.
-- Gefüllt = Gastbeitrag, Nennung unter dem Titel.
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS author_name text;

-- Eine Zeile zur Person: "Berlin'de yaşayan öğretmen".
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS author_note text;

COMMIT;

-- ═══════════════════════════════════════════════════════════
-- Welche Gastbeiträge gibt es?
--
--   SELECT id, title, author_name, is_published
--   FROM public.blog_posts
--   WHERE btrim(coalesce(author_name,'')) <> ''
--   ORDER BY published_at DESC NULLS LAST;
-- ═══════════════════════════════════════════════════════════
