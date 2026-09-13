-- CivicLens spine: geography, change detection, plain-language drafts.
--
-- These three tables are what make the product's promises true: nothing here
-- asserts a fact the official record does not support, and no generated text is
-- publicly readable until an editor approves it.

-- ---------------------------------------------------------------------------
-- 1. Editorial helper (reused by every policy below)
-- ---------------------------------------------------------------------------
create or replace function public.is_editor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.editors e where e.user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- 2. Geography — where a decision actually lands
-- ---------------------------------------------------------------------------
create table if not exists public.decision_geography (
  decision_id uuid primary key references public.decisions(id) on delete cascade,
  address text,
  latitude double precision,
  longitude double precision,
  zip_code text,
  council_district smallint,
  neighborhood text,
  parcel_id text,
  source_url text,
  method text not null default 'none'
    check (method in ('petition-match','address-match','record-text','manual','none')),
  confidence text not null default 'unconfirmed'
    check (confidence in ('exact','likely','unconfirmed')),
  verified_at timestamptz not null default now()
);

create index if not exists decision_geography_zip_idx on public.decision_geography(zip_code);
create index if not exists decision_geography_district_idx on public.decision_geography(council_district);

alter table public.decision_geography enable row level security;

drop policy if exists "geography for public decisions is public" on public.decision_geography;
create policy "geography for public decisions is public"
  on public.decision_geography for select
  using (exists (select 1 from public.decisions d where d.id = decision_id and d.is_published));

drop policy if exists "editors manage geography" on public.decision_geography;
create policy "editors manage geography"
  on public.decision_geography for all
  using (public.is_editor()) with check (public.is_editor());

-- ---------------------------------------------------------------------------
-- 3. Money as a first-class field
--    (119 budget-topic records currently store no figure at all)
-- ---------------------------------------------------------------------------
alter table public.decisions
  add column if not exists amount_usd numeric(14,2),
  add column if not exists fiscal_year text,
  add column if not exists funding_source text;

-- ---------------------------------------------------------------------------
-- 4. Change detection — what makes "following" mean something
-- ---------------------------------------------------------------------------
create table if not exists public.decision_changes (
  id text primary key,
  decision_id uuid not null references public.decisions(id) on delete cascade,
  field text not null
    check (field in ('status','latestUpdate','nextStep','summary','whyItMatters','timeline')),
  previous_value text,
  current_value text,
  changed_at timestamptz not null default now(),
  source_url text,
  notified_at timestamptz
);

create index if not exists decision_changes_recent_idx on public.decision_changes(changed_at desc);
create index if not exists decision_changes_pending_idx on public.decision_changes(decision_id) where notified_at is null;

alter table public.decision_changes enable row level security;

drop policy if exists "changes for public decisions are public" on public.decision_changes;
create policy "changes for public decisions are public"
  on public.decision_changes for select
  using (exists (select 1 from public.decisions d where d.id = decision_id and d.is_published));

drop policy if exists "editors manage changes" on public.decision_changes;
create policy "editors manage changes"
  on public.decision_changes for all
  using (public.is_editor()) with check (public.is_editor());

-- ---------------------------------------------------------------------------
-- 5. Plain-language drafts — a model writes, an editor approves
-- ---------------------------------------------------------------------------
create table if not exists public.decision_drafts (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.decisions(id) on delete cascade,
  field text not null
    check (field in ('summary','whyItMatters','nextStep','beforeText','afterText')),
  draft_text text not null,
  model text not null,
  prompt_version text not null,
  source_excerpts jsonb not null default '[]',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  editor_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (decision_id, field, prompt_version)
);

create index if not exists decision_drafts_pending_idx
  on public.decision_drafts(created_at desc) where status = 'pending';

alter table public.decision_drafts enable row level security;

-- Public readers see approved text only. Editors see everything.
drop policy if exists "approved drafts are public" on public.decision_drafts;
create policy "approved drafts are public"
  on public.decision_drafts for select
  using (status = 'approved' or public.is_editor());

drop policy if exists "editors manage drafts" on public.decision_drafts;
create policy "editors manage drafts"
  on public.decision_drafts for all
  using (public.is_editor()) with check (public.is_editor());

-- ---------------------------------------------------------------------------
-- 6. Search foundation for multi-record retrieval and saved searches
-- ---------------------------------------------------------------------------
create extension if not exists pg_trgm;

create index if not exists decisions_search_idx
  on public.decisions
  using gin (to_tsvector('english', title || ' ' || summary || ' ' || topic));

create index if not exists decisions_title_trgm_idx
  on public.decisions using gin (title gin_trgm_ops);
