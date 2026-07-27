-- Add real ticket/info URLs to seeded events.
-- Matches by title keyword; sets registration_url so the card becomes a working button.

update public.events
   set registration_url = 'https://www.eventim.de/artist/yuezyuezeyken-konusuruz/?srsltid=AfmBOoo95V-Ja5E1R6uG1qxL_aNfYm3YZcB_U4IJYZpEB0Xz1ZH4lD-a',
       link_url         = 'https://www.eventim.de/artist/yuezyuezeyken-konusuruz/?srsltid=AfmBOoo95V-Ja5E1R6uG1qxL_aNfYm3YZcB_U4IJYZpEB0Xz1ZH4lD-a',
       event_type       = 'external'
 where title ilike '%Yüzyüzeyken%';

-- Verify it matched exactly one row:
select title, event_type, registration_url from public.events where title ilike '%Yüzyüzeyken%';
