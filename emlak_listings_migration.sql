-- ============================================================
-- BizdenBize — EMLAK (real estate) listings: dedicated table
-- Run this in the Supabase SQL Editor.
-- Reuses the existing "listing-photos" storage bucket for images.
-- ============================================================

create table if not exists public.emlak_listings (
  id             uuid primary key default gen_random_uuid(),
  created_by     uuid not null references auth.users(id) on delete cascade,
  active         boolean not null default true,          -- false = kaldırıldı (soft-remove)
  status         text    not null default 'aktif',       -- 'aktif' | 'dolu' (kiralandı/satıldı)
  tip            text    not null,                        -- 'kiralik' | 'satilik' | 'sublet' | 'paylasimli'
  title          text    not null,
  price          numeric,                                 -- aylık kira ya da satış fiyatı
  nebenkosten    numeric,                                 -- yan giderler (aylık, opsiyonel)
  kaution        numeric,                                 -- depozito (opsiyonel)
  rooms          text,                                    -- "2+1" / "2 Zimmer"
  size_sqm       numeric,                                 -- m²
  floor          text,                                    -- kat (opsiyonel)
  furnished      boolean not null default false,          -- eşyalı mı
  available_from date,                                    -- müsait olduğu tarih (opsiyonel)
  description    text,
  city           text    not null,
  location       text,                                    -- semt / konum
  photos         text[]  not null default '{}',
  country        text    not null default 'de',
  created_at     timestamptz not null default now()
);

-- Indexes
create index if not exists emlak_active_created_idx on public.emlak_listings (active, created_at desc);
create index if not exists emlak_tip_idx            on public.emlak_listings (tip);
create index if not exists emlak_created_by_idx     on public.emlak_listings (created_by);

-- Row Level Security
alter table public.emlak_listings enable row level security;

-- Anyone (including anonymous visitors) can read active listings
drop policy if exists emlak_select on public.emlak_listings;
create policy emlak_select on public.emlak_listings
  for select to anon, authenticated
  using (active = true);

-- Signed-in users can create listings they own
drop policy if exists emlak_insert on public.emlak_listings;
create policy emlak_insert on public.emlak_listings
  for insert to authenticated
  with check (created_by = auth.uid());

-- Owners can update their own listings (edit / mark filled / remove)
drop policy if exists emlak_update on public.emlak_listings;
create policy emlak_update on public.emlak_listings
  for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());
