-- FnGuide 리포트가 매칭된 검색 키워드를 저장(콤마 구분). 공시 게시글은 빈 문자열.
alter table clippings add column if not exists keyword text not null default '';
