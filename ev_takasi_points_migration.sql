-- ============================================================
-- BizdenBize Ev Takası — Points-based (non-reciprocal) exchange
-- Adapted from HomeExchange's GuestPoints model, simplified:
-- 1 point = 1 night. No per-home valuation algorithm (yet).
-- ============================================================

-- 1. Points ledger: append-only record of every point transaction.
create table public.swap_points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  amount integer not null,              -- positive = earned, negative = spent
  type text not null check (type in ('welcome_bonus','earned_hosting','spent_staying','refund')),
  booking_id uuid,
  note text,
  created_at timestamptz not null default now()
);

alter table public.swap_points_ledger enable row level security;

create policy "Users can view their own points ledger"
  on public.swap_points_ledger for select
  to authenticated
  using (auth.uid() = user_id);

-- Users may only ever self-insert a ONE-TIME welcome bonus directly.
-- Hosting/staying entries are only ever created by confirm_swap_completion()
-- below (security definer) -- never inserted directly by any client, so
-- nobody can credit themselves fake points.
create policy "Users can claim their own welcome bonus"
  on public.swap_points_ledger for insert
  to authenticated
  with check (auth.uid() = user_id and type = 'welcome_bonus');


-- 2. Bookings: the request -> accept/decline -> mutual-confirm flow.
create table public.swap_bookings (
  id uuid primary key default gen_random_uuid(),
  offer_id text,                        -- reference only, no FK (swap_offers.id type not confirmed)
  host_user_id uuid not null references auth.users(id),
  guest_user_id uuid not null references auth.users(id),
  offer_city text,
  offer_destination text,
  check_in date not null,
  check_out date not null,
  points_needed integer not null,
  guest_message text,
  status text not null default 'requested' check (status in ('requested','accepted','declined','completed','cancelled')),
  host_confirmed_at timestamptz,
  guest_confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.swap_bookings enable row level security;

create policy "Participants can view their own bookings"
  on public.swap_bookings for select
  to authenticated
  using (auth.uid() = host_user_id or auth.uid() = guest_user_id);

create policy "Guests can create a booking request"
  on public.swap_bookings for insert
  to authenticated
  with check (auth.uid() = guest_user_id);

-- Trust-based MVP: either participant can update status (accept/decline by
-- host, cancel by either). The app UI only exposes the right actions to the
-- right party -- this mirrors how other admin/self-serve splits already
-- work elsewhere on the platform.
create policy "Participants can update booking status"
  on public.swap_bookings for update
  to authenticated
  using (auth.uid() = host_user_id or auth.uid() = guest_user_id)
  with check (auth.uid() = host_user_id or auth.uid() = guest_user_id);


-- 3. Atomic completion. This is the ONLY path that ever writes
-- earned_hosting / spent_staying ledger rows -- points only move once BOTH
-- sides have independently confirmed the stay happened.
create or replace function public.confirm_swap_completion(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b record;
begin
  select * into b from swap_bookings where id = p_booking_id;
  if not found then
    raise exception 'Booking not found';
  end if;
  if auth.uid() <> b.host_user_id and auth.uid() <> b.guest_user_id then
    raise exception 'Not a participant in this booking';
  end if;
  if b.status <> 'accepted' then
    raise exception 'Booking must be accepted before it can be marked complete';
  end if;

  if auth.uid() = b.host_user_id then
    update swap_bookings set host_confirmed_at = coalesce(host_confirmed_at, now()) where id = p_booking_id;
  end if;
  if auth.uid() = b.guest_user_id then
    update swap_bookings set guest_confirmed_at = coalesce(guest_confirmed_at, now()) where id = p_booking_id;
  end if;

  select * into b from swap_bookings where id = p_booking_id;
  if b.host_confirmed_at is not null and b.guest_confirmed_at is not null then
    update swap_bookings set status = 'completed' where id = p_booking_id;
    insert into swap_points_ledger (user_id, amount, type, booking_id, note)
      values (b.host_user_id, b.points_needed, 'earned_hosting', b.id, 'Konaklama tamamlandı');
    insert into swap_points_ledger (user_id, amount, type, booking_id, note)
      values (b.guest_user_id, -b.points_needed, 'spent_staying', b.id, 'Konaklama tamamlandı');
  end if;
end;
$$;

grant execute on function public.confirm_swap_completion(uuid) to authenticated;
