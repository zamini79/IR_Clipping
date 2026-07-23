import { Board } from "@/components/Board";
import { getBoardData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Page() {
  const data = await getBoardData();
  const updated = "2026.07.22 09:12"; // Phase 2: 최근 수집 시각을 DB에서 산출
  return <Board data={data} updated={updated} />;
}
