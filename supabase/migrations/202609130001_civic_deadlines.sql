-- CivicLens deadlines: the moment a decision stops being changeable.
--
-- The tracker answers "what has the government decided". These columns let the
-- app answer the only question a resident can still act on: "how long do I have".
--
-- Every date here comes from the government's own matter register. Nothing is
-- derived, so a record with no published date simply has a null deadline and
-- reports "no date on record".

-- ---------------------------------------------------------------------------
-- 1. Withdrawn is a real outcome
--    A matter pulled by its sponsor is not "Under review" and is not "Rejected".
--    Filing it as either would misstate what happened, so the enum gains it.
-- ---------------------------------------------------------------------------
alter type public.decision_status add value if not exists 'Withdrawn';

-- ---------------------------------------------------------------------------
-- 2. Deadline, requester and the register's own wording
-- ---------------------------------------------------------------------------
alter table public.decisions
  -- The register's "requester". Sometimes a department, sometimes a staff member,
  -- so it is stored verbatim and attributed as "Requested by" rather than
  -- mislabelled as a department.
  add column if not exists requester text,
  add column if not exists deadline_date date,
  add column if not exists deadline_label text,
  add column if not exists deadline_source_url text,
  add column if not exists deadline_origin text
    check (deadline_origin is null or deadline_origin in ('official-tracker','record-text')),
  -- The register's stage label, quoted verbatim so the interface can attribute it.
  add column if not exists official_status text;

-- The deadline surfaces read by date, so this is the index that matters.
create index if not exists decisions_deadline_idx
  on public.decisions(deadline_date)
  where deadline_date is not null and archived_at is null;

create index if not exists decisions_requester_idx
  on public.decisions(requester)
  where requester is not null;

-- ---------------------------------------------------------------------------
-- 3. A newly scheduled action date is a change worth reporting
--    "A vote date was set" is the movement a resident most needs to hear about,
--    so the change log accepts it as a comparable field.
-- ---------------------------------------------------------------------------
alter table public.decision_changes drop constraint if exists decision_changes_field_check;

alter table public.decision_changes
  add constraint decision_changes_field_check
  check (field in ('status','latestUpdate','nextStep','summary','whyItMatters','timeline','deadline'));

-- ---------------------------------------------------------------------------
-- 4. Deadline coverage, exposed as a view
--    The disclosure report needs to count what was never published. Doing it in
--    SQL keeps the public pages cheap and keeps the arithmetic in one place.
-- ---------------------------------------------------------------------------
create or replace view public.decision_deadline_coverage as
select
  count(*)                                                                      as total,
  count(d.deadline_date)                                                        as with_deadline,
  count(*) filter (where d.status = 'Under review')                              as under_review,
  count(*) filter (where d.requester is null)                                    as without_requester,
  count(*) filter (where d.deadline_date is null
                     and d.status in
                       ('Proposed','Public feedback','Under review','Scheduled for vote','Delayed'))
                                                                                as open_without_date,
  count(*) filter (where d.status in
                       ('Approved','Rejected','Funded','Implementation','Completed','Withdrawn'))
                                                                                as decided
from public.decisions d
where d.is_published;

comment on view public.decision_deadline_coverage is
  'What the record set states, and what it omits. Used by the public evidence page.';
