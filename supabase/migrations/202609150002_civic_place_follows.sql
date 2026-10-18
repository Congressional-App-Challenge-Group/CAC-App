-- Place following.
--
-- A resident cares about a *place* far more often than about a single item: the
-- rezoning two streets over, the school boundary at the end of the road. Until
-- now the watchlist could only hold decisions, so following "District 5" meant
-- following sixteen separate records and re-doing it every time the government
-- published a new one.
--
-- The key is the same `kind:code` string the interface already uses in a URL
-- (`council:5`, `school:3`, `zip:28205`), so a followed place and a shared link
-- are the same value and cannot drift apart. It is stored as text rather than
-- decomposed columns for exactly that reason: re-parsing the key is what the
-- place resolver already does, and a second representation would eventually
-- disagree with the first.
--
-- Deliberately keyed to districts only. A followed *address* is not stored,
-- because that is the resident's home and there is no reason for it to leave
-- their device.

create table if not exists public.place_follows (
  user_id uuid references auth.users(id) on delete cascade,
  place_key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, place_key)
);

alter table public.place_follows enable row level security;

-- Same rule as decision_follows: a resident's watchlist is theirs alone, and the
-- district boundary data it refers to is public elsewhere.
drop policy if exists "users manage place follows" on public.place_follows;
create policy "users manage place follows" on public.place_follows
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists place_follows_user_idx on public.place_follows (user_id);
