alter table clippings add column if not exists board text not null default '';
alter table clippings add column if not exists source_ref text not null default '';
alter table clippings add column if not exists source_url text not null default '';
alter table clippings add column if not exists notified_at timestamptz;

-- 기존 시드 행은 board/source_ref가 비어 UNIQUE 충돌 가능 → 시드는 board='seed', source_ref=id로 채움
update clippings set board = 'seed', source_ref = id::text
  where board = '' and source_ref = '';

create unique index if not exists clippings_board_source_ref_key
  on clippings (board, source_ref);

alter table clipping_files add column if not exists external_url text not null default '';

create table if not exists alert_recipients (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
-- alert_recipients: 공개 select 정책 없음(서버 service_role만 접근). RLS 활성화만.
alter table alert_recipients enable row level security;

-- MANUAL (Supabase Dashboard 또는 CLI):
-- 1) Storage에 비공개 버킷 'clipping-files' 생성.
-- 2) 공개 정책 없이 두고, 서버(service_role)만 업로드/서명URL 발급.
