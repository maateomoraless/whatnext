create extension if not exists pgcrypto;

create table if not exists public.friendships (
  id uuid default gen_random_uuid() primary key,
  requester_id uuid references auth.users(id) on delete cascade,
  addressee_id uuid references auth.users(id) on delete cascade,
  status text check (status in ('pending', 'accepted', 'rejected')) default 'pending',
  created_at timestamptz default now(),
  unique(requester_id, addressee_id)
);

create table if not exists public.user_activity (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  type text check (type in ('watched', 'watchlist', 'rated')),
  movie_id integer,
  movie_title text,
  poster_path text,
  rating numeric,
  created_at timestamptz default now()
);

create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  username text unique,
  avatar_url text,
  created_at timestamptz default now()
);

alter table public.profiles add column if not exists gustos jsonb;

alter table public.friendships enable row level security;
alter table public.user_activity enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_self_and_friends" on public.profiles;
create policy "profiles_select_self_and_friends"
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = auth.uid() and f.addressee_id = profiles.id)
        or (f.addressee_id = auth.uid() and f.requester_id = profiles.id)
      )
  )
);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "friendships_select_self_rows" on public.friendships;
create policy "friendships_select_self_rows"
on public.friendships for select
to authenticated
using (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists "friendships_insert_requester" on public.friendships;
create policy "friendships_insert_requester"
on public.friendships for insert
to authenticated
with check (requester_id = auth.uid() and requester_id <> addressee_id);

drop policy if exists "friendships_update_participants" on public.friendships;
create policy "friendships_update_participants"
on public.friendships for update
to authenticated
using (requester_id = auth.uid() or addressee_id = auth.uid())
with check (
  (requester_id = auth.uid() or addressee_id = auth.uid())
  and status in ('pending', 'accepted', 'rejected')
);

drop policy if exists "activity_select_self_and_friends" on public.user_activity;
create policy "activity_select_self_and_friends"
on public.user_activity for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = auth.uid() and f.addressee_id = user_activity.user_id)
        or (f.addressee_id = auth.uid() and f.requester_id = user_activity.user_id)
      )
  )
);

drop policy if exists "activity_insert_own" on public.user_activity;
create policy "activity_insert_own"
on public.user_activity for insert
to authenticated
with check (user_id = auth.uid());
