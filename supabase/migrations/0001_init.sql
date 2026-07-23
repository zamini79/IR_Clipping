create extension if not exists "pgcrypto";

create table if not exists clippings (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('disclosure','fnguide')),
  title text not null,
  source text not null default '',
  department text not null default '',
  body text not null default '',
  collected_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists clippings_category_collected_at_idx
  on clippings (category, collected_at desc);

create table if not exists clipping_files (
  id uuid primary key default gen_random_uuid(),
  clipping_id uuid not null references clippings(id) on delete cascade,
  name text not null,
  size text not null default '',
  storage_path text not null default ''
);

create index if not exists clipping_files_clipping_id_idx
  on clipping_files (clipping_id);

-- Public read-only access
alter table clippings enable row level security;
alter table clipping_files enable row level security;

create policy "public read clippings" on clippings
  for select using (true);
create policy "public read clipping_files" on clipping_files
  for select using (true);
