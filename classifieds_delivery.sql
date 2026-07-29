-- İlanlar — teslimat şekli (delivery method), Kleinanzeigen tarzı
alter table public.classified_listings
  add column if not exists delivery text;   -- 'kargo' | 'elden' | 'ikisi'

-- kargo = Versand (shipping), elden = Abholung (pickup), ikisi = both
