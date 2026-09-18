"use client";
import Link from "next/link";
import { Header } from "@/components/Header";
import { LevelBadge } from "@/components/LevelBadge";
import { useT } from "@/lib/i18n";
import { useRealtime } from "@/lib/realtime";

/** 셔틀 1단계: 정류장·방향 목록. 다음 출발까지 남은 시간과 "지금 줄 서면 몇 시 차" 를 한 줄로. */
export default function ShuttleHub() {
  const { list } = useRealtime();
  const t = useT();
  const stops = list.filter((r) => r.kind === "shuttle");
  return (
    <>
      <Header title={t("hub.shuttle")} back="/" />
      <main className="space-y-3 p-4">
        <p className="text-xs text-muted">한양대 ERICA 셔틀 시간표(2023.09.01, 학기 중) 기준 · 정류장은 직접 선택 (GPS 미사용)</p>
        {stops.map((r) => (
          <Link key={r.id} href={`/shuttle/${r.id}`} className="card block p-5 transition active:bg-surface-soft">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted">{r.zone} 출발</p>
                <h2 className="truncate font-display text-base text-ink">{r.name}</h2>
              </div>
              <LevelBadge level={r.level} size="sm" />
            </div>
            <div className="mt-3 flex items-end gap-4">
              <div><p className="font-display text-3xl tabular-nums text-ink">{r.next_in_min == null ? "운행 종료" : r.next_in_min === 0 ? "지금" : `${r.next_in_min}분 후`}</p><p className="text-[11px] text-muted">다음 출발 {r.next_departures?.[0] ?? ""}</p></div>
              <div className="flex-1 text-right"><p className="font-display text-xl tabular-nums text-primary">{r.board_time ?? "—"}</p><p className="text-[11px] text-muted">지금 줄 서면 (줄 {r.people_count ?? "-"}명)</p></div>
            </div>
          </Link>
        ))}
      </main>
    </>
  );
}
