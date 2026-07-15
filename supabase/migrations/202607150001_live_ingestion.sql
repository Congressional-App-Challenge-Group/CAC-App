create type public.ingestion_status as enum ('running','completed','failed');
create type public.review_status as enum ('pending','approved','rejected','merged');

alter table public.decisions
  add column if not exists external_key text,
  add column if not exists approved_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists last_checked_at timestamptz,
  add column if not exists importance_score integer not null default 0,
  add column if not exists extraction_confidence numeric(4,3),
  add column if not exists ingestion_source_key text;
create unique index if not exists decisions_external_key_idx on public.decisions(ingestion_source_key,external_key);
create index if not exists decisions_active_updated_idx on public.decisions(archived_at,updated_at desc) where is_published;
create unique index if not exists sources_decision_url_idx on public.sources(decision_id,url);
alter table public.timeline_events add column if not exists external_key text;
create unique index if not exists timeline_events_external_key_idx on public.timeline_events(external_key);

create table public.ingestion_runs (
  id uuid primary key default gen_random_uuid(), source_key text not null,
  started_at timestamptz not null default now(), finished_at timestamptz,
  status public.ingestion_status not null default 'running', documents_found integer not null default 0,
  documents_changed integer not null default 0, candidates_found integer not null default 0, error_message text
);
create table public.raw_documents (
  id uuid primary key default gen_random_uuid(), source_key text not null, external_id text not null,
  canonical_url text not null, title text not null, published_at timestamptz, content_hash text not null,
  content_type text, extracted_text text, raw_payload jsonb, http_etag text, http_last_modified text,
  fetched_at timestamptz not null default now(), unique(source_key,external_id)
);
create table public.decision_candidates (
  id uuid primary key default gen_random_uuid(), raw_document_id uuid not null references public.raw_documents(id) on delete cascade,
  source_key text not null, external_item_id text not null, title text not null, body text not null default '',
  proposed_status public.decision_status not null default 'Under review', event_date date, action_date date,
  importance_score integer not null default 0, extraction_confidence numeric(4,3) not null default .5,
  matched_decision_id uuid references public.decisions(id) on delete set null, review_status public.review_status not null default 'pending',
  parser_version text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(source_key,external_item_id)
);
alter table public.ingestion_runs enable row level security;
alter table public.raw_documents enable row level security;
alter table public.decision_candidates enable row level security;

create or replace function public.archive_stale_decisions() returns integer language plpgsql security definer set search_path=public as $$
declare affected integer;
begin
  update public.decisions set archived_at=now()
  where is_published and archived_at is null and approved_at < now()-interval '60 days'
    and status in ('Approved','Rejected','Funded','Completed');
  get diagnostics affected = row_count;
  return affected;
end $$;
