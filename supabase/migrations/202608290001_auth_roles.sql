-- Editorial role claims: a user in `editors` may publish/update decisions.
create table if not exists public.editors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('editor','admin')),
  created_at timestamptz not null default now()
);

alter table public.editors enable row level security;

-- Editors can read the full editors list (to know their own role).
create policy "editors can read the editors list"
  on public.editors for select
  using (auth.uid() in (select user_id from public.editors));

-- Only an authenticated editor may mutate decisions.
create policy "editors can publish decisions"
  on public.decisions for insert
  with check (auth.uid() in (select user_id from public.editors));

create policy "editors can update decisions"
  on public.decisions for update
  using (auth.uid() in (select user_id from public.editors));

-- Mutations cascade to sources/timeline only through the (RLS-guarded) decisions table.
create policy "editors can manage sources"
  on public.sources for insert
  with check (auth.uid() in (select user_id from public.decisions d join public.editors e on e.user_id = auth.uid() where d.id = decision_id));

create policy "editors can manage timeline events"
  on public.timeline_events for insert
  with check (auth.uid() in (select user_id from public.decisions d join public.editors e on e.user_id = auth.uid() where d.id = decision_id));