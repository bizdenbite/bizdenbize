-- ═══════════════════════════════════════════════════════════
-- BizdenBize · Görüşler — Leser-Einsendungen
--
-- Einsenden ist nur ANGEMELDETEN Mitgliedern möglich: jede
-- Einsendung hängt damit an einem echten Konto mit bestätigter
-- E-Mail-Adresse. Das ist der wirksamste Spamschutz, den es
-- hier gibt — wirksamer als jede Bremse.
--
-- Ablauf: ein angemeldetes Mitglied schickt einen Text →
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
  -- Das Konto, das eingesendet hat. Bewusst ohne NOT NULL in
  -- der Spaltendefinition: bereits vorhandene Zeilen aus der
  -- ersten Fassung sollen nicht kaputtgehen. Erzwungen wird es
  -- in der INSERT-Regel weiter unten — dort kommt ohne
  -- angemeldetes Konto nichts mehr durch.
  user_id      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
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

ALTER TABLE public.blog_submissions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS blog_submissions_user_idx
  ON public.blog_submissions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS blog_submissions_status_idx
  ON public.blog_submissions (status, created_at DESC);

-- ── Bremse gegen Flutung ───────────────────────────────────
-- Login schützt vor Massenversuchen, aber nicht vor einem
-- einzelnen Konto, das im Minutentakt sendet. Deshalb: höchstens
-- 5 Einsendungen pro Konto und Stunde. Wer wirklich schreibt,
-- kommt nie in die Nähe dieser Grenze.
CREATE OR REPLACE FUNCTION public.blog_submissions_throttle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recent int;
BEGIN
  SELECT count(*) INTO recent
  FROM public.blog_submissions
  WHERE user_id = NEW.user_id
    AND created_at > now() - interval '1 hour';

  IF recent >= 5 THEN
    RAISE EXCEPTION 'submission_rate_limit'
      USING HINT = 'Bir saat içinde en fazla 5 yazı gönderebilirsin.';
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
DROP POLICY IF EXISTS "submissions_member_insert" ON public.blog_submissions;
DROP POLICY IF EXISTS "submissions_admin_read"    ON public.blog_submissions;
DROP POLICY IF EXISTS "submissions_admin_edit"    ON public.blog_submissions;
DROP POLICY IF EXISTS "submissions_admin_del"     ON public.blog_submissions;

-- Nur angemeldete Mitglieder mit bestätigtem Konto, und nur
-- im eigenen Namen. status ist festgenagelt, damit niemand
-- sich selbst auf 'accepted' setzt.
CREATE POLICY "submissions_member_insert" ON public.blog_submissions
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND public.bb_is_approved()
    AND status = 'new' AND post_id IS NULL
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
