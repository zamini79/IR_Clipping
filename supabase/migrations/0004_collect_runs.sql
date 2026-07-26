-- 수집 실행 이력. 게시판 헤더의 "최근 수집"은 신규 글이 없어도 갱신돼야 하므로,
-- 마지막으로 들어온 글(created_at)이 아니라 마지막 실행 시각을 여기서 읽는다.
create table if not exists collect_runs (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  source text not null default 'collect',   -- collect | collect-fnguide
  new_count int not null default 0,
  repaired_count int not null default 0,
  error_count int not null default 0
);

create index if not exists collect_runs_ran_at_idx on collect_runs (ran_at desc);

-- 게시판(anon 키)이 읽어야 하므로 공개 select 허용. 쓰기는 service_role만.
alter table collect_runs enable row level security;
drop policy if exists "public read collect_runs" on collect_runs;
create policy "public read collect_runs" on collect_runs for select using (true);
