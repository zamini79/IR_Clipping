// 다이제스트 발송 시각 — 수집 주기와 분리돼 있다.
//
// 수집은 매시간 돌아 게시판을 최신으로 유지하고(헤더의 "최근 수집", NEW 배지),
// 메일은 여기 정의된 창에서만 나간다. 창 밖에서 수집된 글은 notified_at이
// NULL로 남아 다음 창에서 한 번에 묶여 발송된다 — 별도 큐가 필요 없다.

/** 발송 시각(KST, 정시 기준). 매시 수집 중 이 시각의 실행만 메일을 보낸다. */
export const DIGEST_HOURS_KST = [9, 12, 15, 18];

/** 발송 요일(월~금). 주말 수집분은 월요일 09시 발송에 합류한다. */
const DIGEST_WEEKDAYS = new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]);

/** 어떤 시각의 KST 요일·시(0-23). 서버가 UTC라 반드시 KST로 환산해 판단한다. */
export function kstWeekdayHour(at: Date | number = Date.now()): { weekday: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(at));
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "-1");
  return { weekday, hour };
}

/**
 * 지금이 다이제스트 발송 창인가 — 월~금 09/12/15/18시(KST).
 *
 * 시각 단위로 판단하므로 크론이 09:00에 쏘고 파이프라인이 09:03에 끝나도 그
 * 실행은 여전히 09시 창에 속한다. 같은 창에서 두 번 돌더라도 두 번째 실행은
 * 보낼 backlog가 이미 비어 있어 중복 발송되지 않는다.
 */
export function isDigestWindow(at: Date | number = Date.now()): boolean {
  const { weekday, hour } = kstWeekdayHour(at);
  return DIGEST_WEEKDAYS.has(weekday) && DIGEST_HOURS_KST.includes(hour);
}

/**
 * 다음 발송 창이 열리는 시각. 발송이 실패했을 때 "언제 재시도되는지"를
 * 알림에 적기 위한 것 — 한 시간씩 앞으로 훑어 첫 창을 찾는다(최대 8일).
 */
export function nextDigestWindow(at: Date | number = Date.now()): Date {
  const HOUR = 3600_000;
  // 현재 시각이 창 안이더라도 "다음" 창을 원하므로 정시로 내린 뒤 한 시간 전진.
  const start = new Date(new Date(at).setMinutes(0, 0, 0)).getTime() + HOUR;
  for (let i = 0; i < 24 * 8; i++) {
    const t = start + i * HOUR;
    if (isDigestWindow(t)) return new Date(t);
  }
  throw new Error("no digest window in the next 8 days"); // 설정이 비어야만 가능
}

/** 로그용 표기: "Sat 14시" */
export function describeKst(at: Date | number = Date.now()): string {
  const { weekday, hour } = kstWeekdayHour(at);
  return `${weekday} ${String(hour).padStart(2, "0")}시 KST`;
}
