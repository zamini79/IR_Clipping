import type { Category } from "./types";

export interface SeedClipping {
  category: Category;
  title: string;
  source: string;
  department: string;
  collectedAt: string; // ISO
  body: string;
  files: { name: string; size: string }[];
}

export const SEED_CLIPPINGS: SeedClipping[] = [
  // 공시법규 규정 (disclosure) — newest first
  { category: "disclosure", title: "2026년 사업보고서 기재요령 개정 안내", source: "금융감독원", department: "공시제도팀", collectedAt: "2026-07-21T00:00:00.000Z",
    body: "금융감독원이 2026년 사업보고서 기재요령을 개정·공지했습니다. 주요 개정 사항과 적용 시점, 실무 체크포인트를 정리한 자료입니다.",
    files: [{ name: "사업보고서_기재요령_개정.pdf", size: "1.8MB" }, { name: "신구조문대비표.xlsx", size: "320KB" }] },
  { category: "disclosure", title: "ESG 지속가능경영보고서 공시 의무화 단계별 일정", source: "한국거래소", department: "IR기획팀", collectedAt: "2026-07-18T00:00:00.000Z",
    body: "자산규모별 ESG 공시 의무화 도입 일정과 준비 사항을 단계별로 안내합니다.",
    files: [{ name: "ESG공시_로드맵.pdf", size: "2.4MB" }] },
  { category: "disclosure", title: "주요사항보고서 제출기한 관련 실무 유의사항", source: "금융위원회", department: "공시제도팀", collectedAt: "2026-07-15T00:00:00.000Z",
    body: "주요사항보고서 제출기한 산정 및 지연 시 제재 관련 유의사항입니다.",
    files: [{ name: "주요사항보고서_유의사항.pdf", size: "960KB" }, { name: "제출_체크리스트.docx", size: "180KB" }, { name: "FAQ.pdf", size: "540KB" }] },
  { category: "disclosure", title: "내부정보 관리규정 개정 — 자기주식 취득 신고 절차", source: "내부 규정", department: "준법지원팀", collectedAt: "2026-07-11T00:00:00.000Z",
    body: "자기주식 취득·처분 시 내부 신고 절차가 강화되었습니다. 변경된 승인 라인을 확인하세요.",
    files: [{ name: "내부정보관리규정_개정본.pdf", size: "720KB" }] },
  { category: "disclosure", title: "공정공시 대상 확대 관련 실무 가이드라인", source: "한국거래소", department: "공시제도팀", collectedAt: "2026-07-08T00:00:00.000Z",
    body: "공정공시 적용 대상 확대에 따른 실무 대응 가이드라인입니다.",
    files: [{ name: "공정공시_가이드.pdf", size: "1.1MB" }, { name: "사례집.pdf", size: "2.0MB" }] },
  { category: "disclosure", title: "분기보고서 XBRL 재무제표 작성 매뉴얼 (v3.2)", source: "재무회계팀", department: "재무회계팀", collectedAt: "2026-07-03T00:00:00.000Z",
    body: "XBRL 재무제표 작성 매뉴얼 v3.2 버전입니다.", files: [] },
  { category: "disclosure", title: "임원·주요주주 소유상황보고 제출 안내", source: "금융감독원", department: "준법지원팀", collectedAt: "2026-06-27T00:00:00.000Z",
    body: "임원 및 주요주주 특정증권등 소유상황보고서 제출 관련 안내입니다.",
    files: [{ name: "소유상황보고_안내.pdf", size: "640KB" }] },
  { category: "disclosure", title: "연결재무제표 주석 공시 강화 방안", source: "금융위원회", department: "재무회계팀", collectedAt: "2026-06-20T00:00:00.000Z",
    body: "연결재무제표 주석 공시 항목이 확대됩니다.",
    files: [{ name: "주석공시_강화방안.pdf", size: "880KB" }] },
  // FnGuide (fnguide) — newest first
  { category: "fnguide", title: "2Q26 실적 컨센서스 프리뷰 — 반도체 섹터", source: "FnGuide", department: "IR기획팀", collectedAt: "2026-07-22T00:00:00.000Z",
    body: "FnGuide 컨센서스 기준 2분기 실적 전망과 당사 가이던스 비교 자료입니다.",
    files: [{ name: "2Q26_컨센서스_프리뷰.pdf", size: "1.5MB" }] },
  { category: "fnguide", title: "산업 동향 위클리 — 07월 3주차", source: "FnGuide", department: "IR기획팀", collectedAt: "2026-07-19T00:00:00.000Z",
    body: "주요 산업 지표 및 경쟁사 동향 주간 리포트입니다.",
    files: [{ name: "산업동향_0719.pdf", size: "2.2MB" }] },
  { category: "fnguide", title: "당사 목표주가 컨센서스 변동 요약", source: "FnGuide", department: "IR기획팀", collectedAt: "2026-07-16T00:00:00.000Z",
    body: "증권사별 목표주가 및 투자의견 변동 내역을 요약했습니다.",
    files: [{ name: "목표주가_컨센서스.xlsx", size: "260KB" }] },
  { category: "fnguide", title: "기관 수급 및 외국인 지분율 리포트", source: "FnGuide", department: "IR기획팀", collectedAt: "2026-07-12T00:00:00.000Z",
    body: "최근 기관/외국인 매매 동향과 지분율 추이 분석입니다.",
    files: [{ name: "수급리포트.pdf", size: "1.0MB" }] },
  { category: "fnguide", title: "경쟁사 실적 비교 데이터셋 (2Q26)", source: "FnGuide", department: "재무회계팀", collectedAt: "2026-07-05T00:00:00.000Z",
    body: "동종업계 경쟁사 실적 비교 데이터입니다.", files: [] },
];
