import { Board } from "@/components/Board";
import { getBoardData } from "@/lib/data";
import { formatDateTimeKst } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Page() {
  const data = await getBoardData();
  // 최근 수집 시각 = 모든 클리핑 중 가장 최근에 적재된(created_at) 행의 시각(KST).
  const latest = [...data.disclosure, ...data.fnguide]
    .map((c) => c.createdAt)
    .filter(Boolean)
    .sort()
    .at(-1);
  const updated = latest ? formatDateTimeKst(latest) : "—";
  return <Board data={data} updated={updated} />;
}
