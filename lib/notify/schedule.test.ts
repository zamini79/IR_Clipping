import { describe, it, expect } from "vitest";
import {
  isDigestWindow, kstWeekdayHour, describeKst, nextDigestWindow, DIGEST_HOURS_KST,
} from "./schedule";

// 2026-07-27 is a Monday. UTC = KST - 9h.
const kst = (iso: string) => Date.parse(iso); // callers pass explicit +09:00 offsets

describe("kstWeekdayHour", () => {
  it("converts a UTC instant to the KST weekday and hour", () => {
    // 2026-07-27T00:00Z = Monday 09:00 KST
    expect(kstWeekdayHour(Date.parse("2026-07-27T00:00:00Z"))).toEqual({ weekday: "Mon", hour: 9 });
  });

  it("rolls the day over at KST midnight, not UTC midnight", () => {
    // Friday 2026-07-31 16:00Z = Saturday 01:00 KST
    expect(kstWeekdayHour(Date.parse("2026-07-31T16:00:00Z"))).toEqual({ weekday: "Sat", hour: 1 });
  });
});

describe("isDigestWindow", () => {
  it("opens at each scheduled hour on a weekday", () => {
    for (const h of DIGEST_HOURS_KST) {
      const at = kst(`2026-07-27T${String(h).padStart(2, "0")}:00:00+09:00`); // Monday
      expect(isDigestWindow(at), `${h}시`).toBe(true);
    }
  });

  it("stays open for the whole hour, so a slow run still sends", () => {
    expect(isDigestWindow(kst("2026-07-27T09:00:01+09:00"))).toBe(true);
    expect(isDigestWindow(kst("2026-07-27T09:59:59+09:00"))).toBe(true);
    expect(isDigestWindow(kst("2026-07-27T10:00:00+09:00"))).toBe(false);
  });

  it("is closed at unscheduled weekday hours", () => {
    for (const h of [0, 8, 10, 11, 13, 14, 16, 17, 19, 23]) {
      const at = kst(`2026-07-29T${String(h).padStart(2, "0")}:30:00+09:00`); // Wednesday
      expect(isDigestWindow(at), `${h}시`).toBe(false);
    }
  });

  it("is closed all weekend, even at the scheduled hours", () => {
    for (const day of ["2026-08-01", "2026-08-02"]) { // Sat, Sun
      for (const h of DIGEST_HOURS_KST) {
        expect(isDigestWindow(kst(`${day}T${String(h).padStart(2, "0")}:00:00+09:00`)), `${day} ${h}시`).toBe(false);
      }
    }
  });

  it("covers Monday through Friday", () => {
    const week = ["2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30", "2026-07-31"];
    expect(week.map((d) => isDigestWindow(kst(`${d}T12:00:00+09:00`)))).toEqual([true, true, true, true, true]);
  });

  it("judges in KST — a Friday-evening UTC instant is already Saturday here", () => {
    // 2026-07-31T09:00Z is Friday 18:00 KST → send window
    expect(isDigestWindow(Date.parse("2026-07-31T09:00:00Z"))).toBe(true);
    // 2026-08-01T00:00Z is Saturday 09:00 KST → no send
    expect(isDigestWindow(Date.parse("2026-08-01T00:00:00Z"))).toBe(false);
  });
});

describe("nextDigestWindow", () => {
  const at = (iso: string) => nextDigestWindow(Date.parse(iso));

  it("finds the next window later the same day", () => {
    expect(kstWeekdayHour(at("2026-07-28T10:30:00+09:00"))).toEqual({ weekday: "Tue", hour: 12 });
  });

  it("moves to the next day after the last window", () => {
    expect(kstWeekdayHour(at("2026-07-28T19:00:00+09:00"))).toEqual({ weekday: "Wed", hour: 9 });
  });

  it("skips the weekend — a Friday-evening failure retries Monday 09시", () => {
    expect(kstWeekdayHour(at("2026-07-31T18:10:00+09:00"))).toEqual({ weekday: "Mon", hour: 9 });
    expect(kstWeekdayHour(at("2026-08-01T11:00:00+09:00"))).toEqual({ weekday: "Mon", hour: 9 });
  });

  it("returns the following window, never the current one", () => {
    // 12:00 정각에 실패해도 다음 재시도는 15시여야 한다.
    expect(kstWeekdayHour(at("2026-07-28T12:00:00+09:00"))).toEqual({ weekday: "Tue", hour: 15 });
  });
});

describe("describeKst", () => {
  it("labels the instant for the run log", () => {
    expect(describeKst(kst("2026-08-01T14:20:00+09:00"))).toBe("Sat 14시 KST");
  });
});
