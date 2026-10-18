-- CivicLens matter identity, and the geography fields the interface already reads.
--
-- Two separate repairs live here.
--
-- 1. Identity. The tracker counted agenda appearances, not matters, because
--    Charlotte's Legistar assigns a new Matter id to every appearance of the
--    same rezoning petition: "Rezoning Petition: 2025-036" is matter 28286
--    through 29969, ten records for one rezoning. `matter_key` is the identity
--    of the thing itself, and `appearance_ids` keeps every official id it was
--    assembled from so the register join can still be made.
--
-- 2. Geography. `council_district_rep`, its email, and `acres` have been
--    produced by the geography matcher and rendered by the participation panel
--    since the spine landed, but there was nowhere to store them: the columns
--    never existed, the enrichment job never pushed them, and the row mapper
--    never read them. The result was a panel that worked on the static dataset
--    and silently rendered nothing when Supabase was configured.

-- ---------------------------------------------------------------------------
-- 1. Matter identity
-- ---------------------------------------------------------------------------
alter table public.decisions
  -- `petition:<org>:<year>-<seq>`, `matter:<org>:<id>`, or `title:<org>:<title>`
  add column if not exists matter_key text,
  -- Every official matter id this record was assembled from.
  add column if not exists appearance_ids text[] default '{}',
  -- How many agenda appearances were merged into this record.
  add column if not exists appearance_count integer default 1,
  -- Earliest appearance, and most recent official activity.
  add column if not exists first_seen_at timestamptz,
  add column if not exists last_activity_at timestamptz;

-- Identity is looked up on every write and every dedupe check.
create index if not exists decisions_matter_key_idx
  on public.decisions(matter_key)
  where matter_key is not null;

comment on column public.decisions.matter_key is
  'Identity of the underlying matter, independent of how many times it appeared.';
comment on column public.decisions.appearance_ids is
  'Every official matter id merged into this record; used to join the government register.';
comment on column public.decisions.appearance_count is
  'Number of agenda appearances merged. One rezoning filed ten times is one matter with ten appearances.';

-- ---------------------------------------------------------------------------
-- 2. Geography fields the interface already displays
-- ---------------------------------------------------------------------------
alter table public.decision_geography
  -- Petition acreage, when the official dataset states it.
  add column if not exists acres numeric,
  -- District representative and contact, from the city's own council-district layer.
  add column if not exists council_district_rep text,
  add column if not exists council_district_rep_email text;

comment on column public.decision_geography.acres is
  'Site acreage stated by the official dataset. Never inferred from the record text.';
comment on column public.decision_geography.council_district_rep is
  'Representative named by the official council-district dataset, not by CivicLens.';
