-- ═══════════════════════════════════════════════════════════
-- BizdenBize — Admin-Zugriff auf Öneriler und Ders Arayanlar
--
-- Zwei Tabellen nehmen seit Längerem Eingaben entgegen, ohne
-- dass jemand sie sehen oder zurücknehmen kann:
--
--   suggestions      Nutzer schlagen Quellen für Öğrenim und
--                    Kütüphane vor. Danach lesen sie
--                    "İnceledikten sonra sayfaya ekleyeceğiz".
--                    Ohne Leserecht kann dieses Versprechen
--                    niemand einlösen.
--
--   seeker_requests  Eltern, die einen Lehrer suchen. Diese
--                    Anzeigen gehen mit active = true sofort
--                    öffentlich — mit Name und Kontaktdaten —
--                    und es gibt keinen Weg, eine davon wieder
--                    herunterzunehmen.
--
-- VORAUSSETZUNG: gorusler_migration.sql ist gelaufen,
-- public.bb_is_admin() stammt von dort.
--
-- Das Skript ist mehrfach ausführbar (idempotent).
-- ═══════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────
-- 1. Bearbeitungsstand für Vorschläge
-- ───────────────────────────────────────────────────────────
-- Ohne diese Spalte könnte das Panel Vorschläge nur anzeigen
-- und löschen. "Erledigt" wäre nicht festhaltbar, und beim
-- nächsten Öffnen stünde wieder alles als neu da.

ALTER TABLE public.suggestions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'suggestions_status_check') THEN
    ALTER TABLE public.suggestions
      ADD CONSTRAINT suggestions_status_check
      CHECK (status IN ('new', 'done'));
  END IF;
END $$;

-- ───────────────────────────────────────────────────────────
-- 2. RLS einschalten
-- ───────────────────────────────────────────────────────────
-- ACHTUNG: Sobald RLS aktiv ist, gilt alles als verboten, was
-- nicht ausdrücklich erlaubt wird. Deshalb stehen unten auch
-- die Regeln für das, was HEUTE SCHON funktioniert — das
-- Absenden der Formulare und das öffentliche Lesen der
-- Suchanzeigen. Ohne sie würde dieses Skript die Seiten
-- kaputtmachen, statt sie zu vervollständigen.

ALTER TABLE public.suggestions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seeker_requests ENABLE ROW LEVEL SECURITY;

-- ───────────────────────────────────────────────────────────
-- 3. Öneriler — Vorschläge
-- ───────────────────────────────────────────────────────────

-- Absenden: offen, auch ohne Anmeldung. So verhalten sich die
-- Formulare auf ogrenim.html und library.html heute.
DROP POLICY IF EXISTS "suggestions_public_insert" ON public.suggestions;
CREATE POLICY "suggestions_public_insert" ON public.suggestions
  FOR INSERT WITH CHECK (true);

-- Lesen: nur Admin. Ein ungeprüfter Vorschlag ist kein
-- öffentlicher Inhalt, und die Liste soll nicht abgreifbar sein.
DROP POLICY IF EXISTS "suggestions_admin_read" ON public.suggestions;
CREATE POLICY "suggestions_admin_read" ON public.suggestions
  FOR SELECT USING (public.bb_is_admin());

DROP POLICY IF EXISTS "suggestions_admin_update" ON public.suggestions;
CREATE POLICY "suggestions_admin_update" ON public.suggestions
  FOR UPDATE USING (public.bb_is_admin()) WITH CHECK (public.bb_is_admin());

DROP POLICY IF EXISTS "suggestions_admin_delete" ON public.suggestions;
CREATE POLICY "suggestions_admin_delete" ON public.suggestions
  FOR DELETE USING (public.bb_is_admin());

-- ───────────────────────────────────────────────────────────
-- 4. Ders Arayanlar — Suchanzeigen
-- ───────────────────────────────────────────────────────────

-- Absenden: offen, wie heute.
DROP POLICY IF EXISTS "seekers_public_insert" ON public.seeker_requests;
CREATE POLICY "seekers_public_insert" ON public.seeker_requests
  FOR INSERT WITH CHECK (true);

-- Öffentlich lesbar sind nur freigeschaltete Anzeigen. Genau
-- danach fragt nachhilfe.html: active=eq.true. Nimmt der Admin
-- active weg, verschwindet die Anzeige auch dann, wenn jemand
-- die Abfrage von Hand stellt.
DROP POLICY IF EXISTS "seekers_public_read" ON public.seeker_requests;
CREATE POLICY "seekers_public_read" ON public.seeker_requests
  FOR SELECT USING (active = true);

-- Der Admin sieht auch die ausgeblendeten.
DROP POLICY IF EXISTS "seekers_admin_read" ON public.seeker_requests;
CREATE POLICY "seekers_admin_read" ON public.seeker_requests
  FOR SELECT USING (public.bb_is_admin());

DROP POLICY IF EXISTS "seekers_admin_update" ON public.seeker_requests;
CREATE POLICY "seekers_admin_update" ON public.seeker_requests
  FOR UPDATE USING (public.bb_is_admin()) WITH CHECK (public.bb_is_admin());

DROP POLICY IF EXISTS "seekers_admin_delete" ON public.seeker_requests;
CREATE POLICY "seekers_admin_delete" ON public.seeker_requests
  FOR DELETE USING (public.bb_is_admin());

COMMIT;

-- ═══════════════════════════════════════════════════════════
-- KONTROLLE — diese drei Abfragen einzeln ausführen:
--
-- 1) Liegen überhaupt Vorschläge da, die nie jemand gesehen hat?
--    SELECT page, status, count(*)
--    FROM public.suggestions GROUP BY page, status ORDER BY 1,2;
--
-- 2) Wie viele Suchanzeigen sind öffentlich?
--    SELECT active, count(*)
--    FROM public.seeker_requests GROUP BY active;
--
-- 3) Sind die Regeln angekommen?
--    SELECT tablename, policyname, cmd FROM pg_policies
--    WHERE tablename IN ('suggestions','seeker_requests')
--    ORDER BY tablename, policyname;
-- ═══════════════════════════════════════════════════════════
