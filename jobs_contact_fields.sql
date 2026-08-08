-- ═══════════════════════════════════════════════════
-- BizdenBize — jobs: add contact fields (website, name, email, whatsapp)
-- email + whatsapp are shown publicly ONLY on employer (is_ilani) listings;
-- individuals keep in-app messaging (enforced in the page, not the DB).
-- Run ONCE in Supabase → SQL Editor. Safe / additive.
-- ═══════════════════════════════════════════════════
BEGIN;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS website      TEXT,
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS email        TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp     TEXT;

COMMIT;
