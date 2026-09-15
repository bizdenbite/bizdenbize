-- ═══════════════════════════════════════════════════════════
-- BizdenBize · Görüşler — Leser-Einsendungen
--
-- Ablauf: jemand schickt einen Text über das Formular →
-- landet als 'new' in dieser Tabelle → du liest ihn in der
-- Görüşler-Verwaltung → "Yazıya dönüştür" macht daraus einen
-- ENTWURF in blog_posts. Veröffentlicht wird er erst, wenn du
-- im Editor auf Yayınla drückst.
--
-- Eine Einsendung wird also NIE automatisch zum Beitrag.
--
-- VORAUSSETZUNG: gorusler_migration.sql ist gelaufen
-- (public.bb_is_admin() kommt von dort).
-- ═══════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.blog_submissions (
  id           bigserial PRIMARY KEY,
  author_name  text        NOT NULL CHECK (btrim(author_name) <> '' AND length(author_name) <= 80),
  author_email text        NOT NULL CHECK (author_email ~ '^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$'
                                           AND length(author_email) <= 254),
  author_note  text        CHECK (author_note IS NULL OR length(author_note) <= 120),
  title        text        NOT NULL CHECK (length(btrim(title)) BETWEEN 5 AND 200),
  -- Untergrenze mit Absicht: ein Text unter 200 Zeichen ist
  -- kein Beitrag, sondern ein Kommentar oder ein Test.
  body         text        NOT NULL CHECK (length(btrim(body)) BETWEEN 200 AND 40000),

  -- Der zugestimmte Wortlaut, mitgespeichert. Ohne diese
  -- Zustimmung darfst du einen fremden Text nicht
  -- veröffentlichen — im Zweifel zählt, was dastand.
  consent_text text,

  status       text        NOT NULL DEFAULT 'new'
                             CHECK (status IN ('new','accepted','rejected')),
  admin_note   text,
  reviewed_at  timestamptz,
  reviewed_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  post_id      bigint      REFERENCES public.blog_posts(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS blog_submissions_status_idx
  ON public.blog_submissions (status, created_at DESC);

-- ── Bremse gegen Flutung ───────────────────────────────────
-- Das Formular steht offen, also kann jeder schreiben. Ohne
-- Bremse genügt ein Skript, um die Tabelle zuzumüllen.
-- 20 Einsendungen pro Stunde insgesamt ist für eine Seite
-- dieser Größe reichlich und stoppt Massenversuche sofort.
CREATE OR REPLACE FUNCTION public.blog_submissions_throttle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recent int;
BEGIN
  SELECT count(*) INTO recent
  FROM public.blog_submissions
  WHERE created_at > now() - interval '1 hour';

  IF recent >= 20 THEN
    RAISE EXCEPTION 'submission_rate_limit'
      USING HINT = 'Şu an çok fazla gönderi var, biraz sonra tekrar dene.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS blog_submissions_throttle_trg ON public.blog_submissions;
CREATE TRIGGER blog_submissions_throttle_trg
  BEFORE INSERT ON public.blog_submissions
  FOR EACH ROW EXECUTE FUNCTION public.blog_submissions_throttle();

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE public.blog_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "submissions_public_insert" ON public.blog_submissions;
DROP POLICY IF EXISTS "submissions_admin_read"    ON public.blog_submissions;
DROP POLICY IF EXISTS "submissions_admin_edit"    ON public.blog_submissions;
DROP POLICY IF EXISTS "submissions_admin_del"     ON public.blog_submissions;

-- Jeder darf einsenden — auch ohne Konto. Aber NUR einsenden:
-- status ist festgenagelt, damit niemand sich selbst auf
-- 'accepted' setzt.
CREATE POLICY "submissions_public_insert" ON public.blog_submissions
  FOR INSERT WITH CHECK (
    status = 'new' AND post_id IS NULL
    AND reviewed_at IS NULL AND reviewed_by IS NULL AND admin_note IS NULL
  );

-- Lesen darf NUR das Adminkonto. Kein Absender kann sehen,
-- was andere geschickt haben — auch nicht den eigenen Text
-- wieder abrufen. Einsendungen sind keine öffentliche Ablage.
CREATE POLICY "submissions_admin_read" ON public.blog_submissions
  FOR SELECT USING (public.bb_is_admin());

CREATE POLICY "submissions_admin_edit" ON public.blog_submissions
  FOR UPDATE USING (public.bb_is_admin()) WITH CHECK (public.bb_is_admin());

CREATE POLICY "submissions_admin_del" ON public.blog_submissions
  FOR DELETE USING (public.bb_is_admin());

COMMIT;

-- ═══════════════════════════════════════════════════════════
-- ÜBERBLICK:
--   SELECT status, count(*) FROM public.blog_submissions GROUP BY status;
--
-- AUFRÄUMEN (abgelehnte nach 90 Tagen löschen — es gibt keinen
-- Grund, fremde Texte und E-Mail-Adressen länger zu behalten):
--   DELETE FROM public.blog_submissions
--   WHERE status = 'rejected' AND reviewed_at < now() - interval '90 days';
-- ═══════════════════════════════════════════════════════════
