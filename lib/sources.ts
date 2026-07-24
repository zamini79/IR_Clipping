// Static registry of the sites the collection pipeline crawls, for the
// "수집 사이트 리스트" panel on the board. Kept in sync with lib/collectors/*
// (COLLECTORS in app/api/collect/route.ts + the FnGuide daily endpoint).

export interface CrawlSource {
  org: string; // 기관/출처
  board: string; // 게시판/코너 이름
  url: string; // 사람이 볼 수 있는 원문 목록 페이지
  note?: string; // 수집 방식 등 부가 설명
}

export interface CrawlSourceGroup {
  category: "disclosure" | "fnguide";
  label: string; // 탭 이름
  sources: CrawlSource[];
}

export const CRAWL_SOURCES: CrawlSourceGroup[] = [
  {
    category: "disclosure",
    label: "공시법규 규정",
    sources: [
      { org: "금융위원회", board: "보도자료", url: "https://www.fsc.go.kr/no010101" },
      { org: "금융위원회", board: "소관규정 · 고시 · 공고 · 훈령", url: "https://www.fsc.go.kr/po040200" },
      { org: "공정거래위원회", board: "보도자료", url: "https://www.ftc.go.kr/www/selectBbsNttList.do?bordCd=3&key=12" },
      { org: "금융감독원(DART)", board: "보도자료", url: "https://dart.fss.or.kr/info/searchBodo.do" },
      { org: "금융감독원(DART)", board: "안내 · 해설", url: "https://dart.fss.or.kr/info/searchGuide.do" },
      { org: "금융감독원(DART)", board: "공시유의사항", url: "https://dart.fss.or.kr/info/searchGuide02.do" },
      { org: "상장회사협의회", board: "공문", url: "https://www.klca.or.kr/sub/comm/official_document.asp", note: "로그인 필요" },
      { org: "상장회사협의회", board: "보도자료", url: "https://www.klca.or.kr/sub/comm/news_release.asp", note: "로그인 필요" },
      { org: "상장회사협의회", board: "법령정보", url: "https://www.klca.or.kr/sub/law/legal_information.asp", note: "로그인 필요" },
      { org: "한국거래소(KCLIC)", board: "공지사항", url: "https://kclic.krx.co.kr/sprtroom/notice.do", note: "로그인 필요" },
    ],
  },
  {
    category: "fnguide",
    label: "FnGuide",
    sources: [
      { org: "FnGuide", board: "리서치 리포트 검색", url: "https://www.fnguide.com/Research/SearchReport", note: "키워드 기반 검색 · 로그인 필요" },
    ],
  },
];
