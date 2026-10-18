-- CivicLens places: which of a resident's representatives decides a matter.
--
-- The geography spine placed a decision on a parcel. That is not the same as
-- saying *who votes on it*. These columns carry the districts that contain the
-- parcel, resolved from Mecklenburg County's own published boundary layers, so a
-- resident can ask "what is happening in my district" and get an answer that
-- names the body — and the person — rather than the neighbourhood.
--
-- Every value is a value the county published. A parcel that falls outside a
-- layer (17 rezonings sit outside Charlotte's council districts) simply has a
-- null column, which the interface reports as "not in a district" rather than
-- assigning the nearest council member.

-- ---------------------------------------------------------------------------
-- 1. Districts on the geography row
-- ---------------------------------------------------------------------------
alter table public.decision_geography
  -- City council. The representative and email come from the same layer, so the
  -- panel can attribute the district to a sitting member.
  add column if not exists council_district           smallint,
  add column if not exists council_district_rep       text,
  add column if not exists council_district_rep_email text,
  -- County commission.
  add column if not exists county_district            smallint,
  add column if not exists county_district_rep        text,
  add column if not exists county_district_rep_email  text,
  -- CMS Board of Education.
  add column if not exists school_board_district      smallint,
  -- State and federal, stored as the county publishes them ("12", not "NC-12").
  add column if not exists congressional_district     text,
  add column if not exists state_house_district       text,
  add column if not exists state_senate_district      text;

-- District pages and "what is in my district" both filter on these, and both are
-- asked for one district at a time.
create index if not exists decision_geography_council_district_idx
  on public.decision_geography(council_district)
  where council_district is not null;

create index if not exists decision_geography_county_district_idx
  on public.decision_geography(county_district)
  where county_district is not null;

create index if not exists decision_geography_school_district_idx
  on public.decision_geography(school_board_district)
  where school_board_district is not null;

-- ---------------------------------------------------------------------------
-- 2. Place coverage, exposed as a view
--
-- The most misleading number this product could print is "N decisions affect
-- you", because a record with no resolved location cannot be shown to affect
-- anyone. This view exists so that count is always published beside what could
-- not be placed.
-- ---------------------------------------------------------------------------
create or replace view public.decision_place_coverage as
select
  count(*)                                                        as total,
  count(g.decision_id)                                            as with_geography,
  count(g.council_district)                                       as with_council_district,
  count(g.county_district)                                        as with_county_district,
  count(g.school_board_district)                                  as with_school_district,
  count(g.congressional_district)                                 as with_congressional_district,
  count(*) filter (where g.decision_id is null)                   as without_any_location,
  count(*) filter (where g.decision_id is not null
                     and g.council_district is null
                     and g.county_district is null)               as located_outside_districts
from public.decisions d
left join public.decision_geography g on g.decision_id = d.id
where d.is_published;

comment on view public.decision_place_coverage is
  'How much of the record set can be placed in a district, and how much cannot.';

-- ---------------------------------------------------------------------------
-- 3. A district panel needs the district's own label
--
-- The label ("City Council District 5") is built once, in TypeScript, from the
-- district kind and code, so it is not duplicated here. This helper exists only
-- so SQL callers can group by a readable name without re-implementing the
-- mapping.
-- ---------------------------------------------------------------------------
create or replace function public.civic_place_label(kind text, code text)
returns text
language sql
immutable
as $$
  select case kind
    when 'council'  then 'City Council District ' || code
    when 'county'   then 'County Commission District ' || code
    when 'school'   then 'CMS Board District ' || code
    when 'zip'      then 'ZIP ' || code
    when 'congress' then 'Congressional District ' || code
    when 'house'    then 'NC House District ' || code
    when 'senate'   then 'NC Senate District ' || code
    else null
  end;
$$;

comment on function public.civic_place_label(text, text) is
  'Mirrors the label mapping in src/lib/place.ts so SQL and TypeScript agree.';
