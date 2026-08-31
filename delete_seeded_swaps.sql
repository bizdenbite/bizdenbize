-- ══════════════════════════════════════════════════════════════════════
--  BizdenBize — remove the six seeded ev-takası listings
--  Aug 2026 · pre-launch
--
--  WHY: seed_swaps.sql inserted six invented people with invented phone
--  numbers and email addresses, every one flagged verified = true and two
--  flagged featured. Fabricated profiles carrying a verification badge is
--  the sharpest possible version of the platform's core rule being broken,
--  and members can see them today.
--
--  Matched on the exact seeded contact strings, so a real listing that
--  happens to share a first name cannot be caught by mistake.
-- ══════════════════════════════════════════════════════════════════════

-- ── STEP 1: look before deleting (run on its own first) ───────────────
SELECT id, user_name, city, contact, verified, featured, active, created_at
FROM public.swap_offers
WHERE contact IN (
  '+49 176 123 4567', 'murat@email.de', '+49 89 123 4567',
  'hasan@email.de',   'zeynep@email.de', '+49 69 456 7890'
)
ORDER BY created_at;
-- Expect exactly 6 rows: Ayse K., Murat D., Fatma A., Hasan B., Zeynep O., Kerim Y.
-- If you see anything else, STOP.

-- ── STEP 2: total row count, so you know what is left afterwards ──────
SELECT count(*) AS total_swap_offers FROM public.swap_offers;


-- ══════════════════════════════════════════════════════════════════════
--  STEP 3 — the delete. Run only after Step 1 returned exactly those 6.
-- ══════════════════════════════════════════════════════════════════════
BEGIN;

DELETE FROM public.swap_offers
WHERE contact IN (
  '+49 176 123 4567', 'murat@email.de', '+49 89 123 4567',
  'hasan@email.de',   'zeynep@email.de', '+49 69 456 7890'
)
RETURNING id, user_name, city;
-- Should report 6 rows. If it reports a different number, ROLLBACK.

COMMIT;

-- ── VERIFY after commit ───────────────────────────────────────────────
--   SELECT count(*) FROM public.swap_offers;
--   SELECT count(*) FROM public.swap_offers WHERE verified = true;
--
-- Then delete seed_swaps.sql from the GitHub repo so it cannot be re-run.
