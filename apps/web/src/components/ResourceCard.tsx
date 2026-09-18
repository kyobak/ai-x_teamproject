import Link from "next/link";
import type { Resource } from "@/lib/api";
import { waitText } from "@/lib/format";
import { LevelBadge } from "./LevelBadge";
import { SourceNote } from "./SourceNote";

/** 대시보드의 자원 카드. 종류별로 핵심 숫자 하나만 크게 보여줍니다. */
export function ResourceCard({ r }: { r: Resource }) {
  const href =
    r.kind === "cafeteria" ? `/cafeteria/${r.id}` :
    r.kind === "shuttle" ? "/shuttle" :
    r.kind === "laundry" ? "/laundry" : "/admin";

  let big = "—";
  let sub = "";
  if (r.kind === "cafeteria" || r.kind === "shuttle") {
    big = r.est_wait_min != null ? waitText(r.est_wait_min) : (r.level_ko ?? "—");
    sub = r.people_count != null ? `줄 ${r.people_count}명` : "";
    if (r.kind === "shuttle" && r.buses_to_wait != null) sub += ` · ${r.buses_to_wait === 0 ? "다음 차 탑승" : `${r.buses_to_wait}대 뒤 탑승`}`;
  } else if (r.kind === "laundry") {
    big = r.state === "available" ? "사용 가능" : r.state === "in_use" ? (r.remaining_min != null ? `${r.remaining_min}분 남음` : "사용 중") : "상태 불명";
    sub = r.queue_length ? `대기 ${r.queue_length}명` : "";
  } else {
    big = r.occupancy_count != null ? `${r.occupancy_count}${r.capacity ? ` / ${r.capacity}` : ""}` : (r.level_ko ?? "—");
  }

  return (
    <Link href={href} className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition active:scale-[0.99]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">{r.zone}</p>
          <h3 className="truncate text-base font-semibold text-slate-900">{r.name}</h3>
        </div>
        {(r.kind === "cafeteria" || r.kind === "shuttle" || r.kind === "space" || r.kind === "parking") && <LevelBadge level={r.level} size="sm" />}
        {r.kind === "laundry" && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.state === "available" ? "bg-emerald-50 text-emerald-700" : r.state === "in_use" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
            {r.machine_type === "dryer" ? "건조기" : "세탁기"}
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{big}</p>
      {sub && <p className="text-sm text-slate-600">{sub}</p>}
      {(r.kind === "cafeteria" || r.kind === "shuttle") && <div className="mt-1"><SourceNote source={r.source} note={r.note} seenAt={r.vision_seen_at} /></div>}
    </Link>
  );
}
