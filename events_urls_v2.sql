-- Robust URL update — matches on ASCII-safe fragment to avoid any ü encoding mismatch.
-- 'Konu' + 'uruz' avoids the Turkish characters entirely.

update public.events
   set registration_url = 'https://www.eventim.de/artist/yuezyuezeyken-konusuruz/',
       link_url         = 'https://www.eventim.de/artist/yuezyuezeyken-konusuruz/',
       event_type       = 'external'
 where title ilike '%Konu%uruz%' or title ilike '%Almanya Turnesi%';

-- Show the result — does it now have a url?
select title, event_type,
       case when registration_url is null then '❌ NO URL' else '✓ '||left(registration_url,40) end as url_status
from public.events
where title ilike '%Konu%uruz%' or title ilike '%Almanya Turnesi%';
