-- ============================================================
-- Who is waiting, and who is missing a name?
-- ------------------------------------------------------------
-- profiles.status gates the whole app: mahallem.html sends anyone
-- who isn't 'approved' back to login. Until now the admin panel had
-- no UI for this at all, so approvals were happening directly in
-- Supabase.
-- ============================================================

-- 1. Overview
SELECT status,
       count(*) AS members,
       count(*) FILTER (
         WHERE coalesce(btrim(first_name), '') = ''
            OR coalesce(btrim(last_name),  '') = ''
       ) AS missing_a_name
FROM public.profiles
GROUP BY status
ORDER BY status;

-- 2. Everyone waiting, newest first — the queue you'll now see in admin
SELECT id, first_name, last_name, city, created_at,
       CASE WHEN coalesce(btrim(first_name),'') = ''
              OR coalesce(btrim(last_name), '') = ''
            THEN '⚠ isim eksik' ELSE 'ok' END AS name_check
FROM public.profiles
WHERE status IS DISTINCT FROM 'approved'
ORDER BY created_at DESC;

-- 3. Already-approved members who slipped through without a full name.
--    These are the ones to chase, since they're already inside.
SELECT id, first_name, last_name, city, created_at
FROM public.profiles
WHERE status = 'approved'
  AND (coalesce(btrim(first_name),'') = '' OR coalesce(btrim(last_name),'') = '')
ORDER BY created_at;
