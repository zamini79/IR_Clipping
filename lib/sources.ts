// Static registry of the sites the collection pipeline crawls, for the
// "수집 사이트 리스트" panel on the board. Kept in sync with lib/collectors/*
// (COLLECTORS in app/api/collect/route.ts + the FnGuide daily endpoint).

// FnGuide 리서치는 전수 수집이 아니라 이 키워드들로 제목 검색해 수집한다.
// (검색 로직은 lib/collectors/fnguide.ts가 이 목록을 import해서 사용.) client-safe
// 하도록 여기(노드 의존성 없는 모듈)에 둔다 — 수집 사이트 리스트 UI가 함께 표시.
export const FNGUIDE_KEYWORDS = [
  "SK바이오사이언스", "SKBioscience", "삼성바이오로직스", "GC녹십자", "한미약품", "유한양행",
  "제약바이오 전망", "제약바이오 동향", "백신", "mRNA", "CGT", "PCV", "폐렴구균", "MSCI",
  "JPMHC", "JPMHealthcare", "JPM헬스케어", "감염병", "독감", "대상포진", "수두", "인플루엔자",
  "RSV", "IDT",
];

// Boards whose 원문(detail) page is members-only: the external "원문 보기" link
// redirects to a login page for public visitors, so the detail modal marks it
// "(로그인 필요)". (KLCA 공문/보도자료/법령정보, KRX KCLIC.)
export const LOGIN_REQUIRED_BOARDS = new Set(["klca-doc", "klca-news", "klca-law", "kclic"]);

export function isLoginRequiredBoard(board: string): boolean {
  return LOGIN_REQUIRED_BOARDS.has(board);
}

// 법제처 입법예고도 전수가 아니라 키워드 검색으로 수집한다. FNGUIDE_KEYWORDS와
// 같은 이유로 client-safe한 이 파일에 둔다(수집 사이트 리스트 UI가 함께 표시).
export const MOLEG_KEYWORDS = ["상법", "자본시장"];

export interface CrawlSource {
  id: string; // 수집기 id — clippings.board 컬럼에 저장되는 값
  org: string; // 기관/출처
  board: string; // 게시판/코너 이름
  short?: string; // 목록 표에 쓰는 짧은 이름(생략하면 board 그대로)
  url: string; // 사람이 볼 수 있는 원문 목록 페이지
  note?: string; // 수집 방식 등 부가 설명
  keywords?: string[]; // 키워드 기반 수집원(FnGuide)의 검색 키워드 목록
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
      { id: "fsc-bodo", org: "금융위원회", board: "보도자료", url: "https://www.fsc.go.kr/no010101" },
      { id: "fsc-reg", org: "금융위원회", board: "소관규정 · 고시 · 공고 · 훈령", short: "소관규정 · 고시", url: "https://www.fsc.go.kr/po040200" },
      { id: "ftc-bodo", org: "공정거래위원회", board: "보도자료", url: "https://www.ftc.go.kr/www/selectBbsNttList.do?bordCd=3&key=12" },
      { id: "fss-bodo", org: "금융감독원(DART)", board: "보도자료", url: "https://dart.fss.or.kr/info/searchBodo.do" },
      { id: "fss-guide", org: "금융감독원(DART)", board: "안내 · 해설", url: "https://dart.fss.or.kr/info/searchGuide.do" },
      { id: "fss-guide02", org: "금융감독원(DART)", board: "공시유의사항", url: "https://dart.fss.or.kr/info/searchGuide02.do" },
      { id: "klca-doc", org: "상장회사협의회", board: "공문", url: "https://www.klca.or.kr/sub/comm/official_document.asp" },
      { id: "klca-news", org: "상장회사협의회", board: "보도자료", url: "https://www.klca.or.kr/sub/comm/news_release.asp" },
      { id: "klca-law", org: "상장회사협의회", board: "법령정보", url: "https://www.klca.or.kr/sub/law/legal_information.asp" },
      { id: "kclic", org: "한국거래소(KCLIC)", board: "공지사항", url: "https://kclic.krx.co.kr/sprtroom/notice.do" },
      {
        id: "moleg",
        org: "법제처",
        board: "입법예고",
        url: "https://moleg.go.kr/lawinfo/makingList.mo?mid=a10104010000",
        keywords: MOLEG_KEYWORDS,
      },
    ],
  },
  {
    category: "fnguide",
    label: "FnGuide",
    sources: [
      { id: "fnguide", org: "FnGuide", board: "리서치 리포트 검색", short: "리서치 리포트", url: "https://www.fnguide.com/Research/SearchReport", keywords: FNGUIDE_KEYWORDS },
    ],
  },
];

/**
 * 수집기 id(= clippings.board) → 게시판(하위 분류) 이름.
 *
 * 목록의 "출처"는 기관(대분류)만 보여주므로, 같은 기관의 여러 게시판이 구분되지
 * 않는다. 이 표를 통해 행마다 어느 게시판에서 온 글인지 함께 표시한다.
 * CRAWL_SOURCES가 유일한 정의처 — 수집원을 추가하면 여기도 자동 반영된다.
 */
const BOARD_LABELS: Record<string, { full: string; short: string }> = Object.fromEntries(
  CRAWL_SOURCES.flatMap((g) => g.sources).map((s) => [s.id, { full: s.board, short: s.short ?? s.board }])
);

/** 목록 표에 쓰는 짧은 게시판 이름. 모르는 board면 "". */
export function boardLabel(board: string): string {
  return BOARD_LABELS[board]?.short ?? "";
}

/** 상세 모달 등에 쓰는 게시판 정식 이름. 모르는 board면 "". */
export function boardFullLabel(board: string): string {
  return BOARD_LABELS[board]?.full ?? "";
}
