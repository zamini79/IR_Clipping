import { Board } from "@/components/Board";
import { getBoardData, getLastRunAt } from "@/lib/data";
import { formatDateTimeKst } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const [data, lastRunAt] = await Promise.all([getBoardData(), getLastRunAt()]);
  // Digest emails link to ?id=<clippingId>, which opens that post's detail.
  const { id } = await searchParams;
  // 최근 수집 = 마지막으로 수집을 실행한 시각(KST). 실행 이력이 아직 없으면
  // 가장 최근에 적재된 글의 시각으로 대체.
  const newestPost = [...data.disclosure, ...data.fnguide]
    .map((c) => c.createdAt)
    .filter(Boolean)
    .sort()
    .at(-1);
  const stamp = lastRunAt ?? newestPost;
  const updated = stamp ? formatDateTimeKst(stamp) : "—";
  return <Board data={data} updated={updated} initialDetailId={id ?? null} />;
}
